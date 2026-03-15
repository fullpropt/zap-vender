$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

$workdir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $workdir

function Invoke-NodeScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Script
    )

    $raw = $Script | node -
    if ($LASTEXITCODE -ne 0) {
        throw "Node script failed: $raw"
    }

    $jsonLine = ($raw -split "`r?`n" | Where-Object { $_ -match '^\{' } | Select-Object -Last 1)
    if (-not $jsonLine) {
        throw "Unable to parse JSON output from node script. Output: $raw"
    }

    return ($jsonLine | ConvertFrom-Json)
}

function Invoke-SmokeApi {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [object]$Body = $null,
        [string]$Token = $null
    )

    $uri = "http://127.0.0.1:3001$Path"
    $client = New-Object System.Net.Http.HttpClient
    $methodUpper = $Method.ToUpperInvariant()
    $httpMethod = New-Object System.Net.Http.HttpMethod($methodUpper)
    $request = New-Object System.Net.Http.HttpRequestMessage($httpMethod, $uri)

    if ($Token) {
        $request.Headers.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $Token)
    }

    if ($null -ne $Body) {
        $jsonBody = $Body | ConvertTo-Json -Depth 10 -Compress
        $request.Content = New-Object System.Net.Http.StringContent($jsonBody, [System.Text.Encoding]::UTF8, 'application/json')
    }

    try {
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        $statusCode = [int]$response.StatusCode
        $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    } catch {
        return [pscustomobject]@{
            status = -1
            body = $_.Exception.Message
        }
    } finally {
        $request.Dispose()
        $client.Dispose()
    }

    $parsed = $content
    try { $parsed = $content | ConvertFrom-Json } catch {}

    return [pscustomobject]@{
        status = $statusCode
        body = $parsed
    }
}

function Invoke-LoginWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Email,
        [Parameter(Mandatory = $true)][string]$Password,
        [int]$MaxAttempts = 8
    )

    $last = $null
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        $last = Invoke-SmokeApi -Method 'POST' -Path '/api/auth/login' -Body @{ email = $Email; password = $Password }
        $bodyText = ''
        if ($last.body -is [string]) {
            $bodyText = [string]$last.body
        } else {
            try { $bodyText = ($last.body | ConvertTo-Json -Depth 6 -Compress) } catch { $bodyText = '' }
        }

        $transientPoolError =
            $last.status -eq 500 -and
            $bodyText -like '*Cannot use a pool after calling end on the pool*'

        if (-not $transientPoolError) {
            return $last
        }

        Start-Sleep -Milliseconds 1000
    }

    return $last
}

$seedScript = @'
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { User, Lead, WhatsAppSession } = require('./server/database/models');
const { hashPassword } = require('./server/middleware/auth');

const PASSWORD = 'Smoke#2026!';

async function ensureUser({ email, name, role, ownerUserId = null }) {
  let user = await User.findByEmail(email, { includeInactive: true });
  if (!user) {
    const created = await User.create({
      name,
      email,
      password_hash: hashPassword(PASSWORD),
      role,
      owner_user_id: ownerUserId || undefined,
      email_confirmed: 1,
      is_active: 1
    });
    user = await User.findByIdWithPassword(created.id);
  }

  const updates = {};
  if (String(user.role || '').toLowerCase() !== String(role || '').toLowerCase()) updates.role = role;
  const currentOwner = Number(user.owner_user_id || 0) || null;
  const nextOwner = Number(ownerUserId || 0) || null;
  if (currentOwner !== nextOwner) updates.owner_user_id = nextOwner;
  if (Number(user.is_active || 0) !== 1) updates.is_active = 1;
  if (Number(user.email_confirmed || 0) !== 1) updates.email_confirmed = 1;
  if (Object.keys(updates).length) await User.update(user.id, updates);
  await User.updatePassword(user.id, hashPassword(PASSWORD));
  return await User.findByIdWithPassword(user.id);
}

async function ensureLead({ phone, name, assignedTo, ownerUserId }) {
  const result = await Lead.findOrCreate({
    phone,
    name,
    source: 'manual',
    status: 1,
    assigned_to: assignedTo,
    owner_user_id: ownerUserId
  }, {
    owner_user_id: ownerUserId
  });
  const lead = result.lead;
  if (!lead) throw new Error('Failed to prepare smoke lead');
  if (Number(lead.assigned_to || 0) !== Number(assignedTo || 0)) {
    await Lead.update(lead.id, { assigned_to: assignedTo });
  }
  return await Lead.findById(lead.id);
}

(async () => {
  let adminA = await ensureUser({ email: 'smoke.admin.a@local.test', name: 'Smoke Admin A', role: 'admin' });
  if (Number(adminA.owner_user_id || 0) !== Number(adminA.id || 0)) {
    await User.update(adminA.id, { owner_user_id: adminA.id, role: 'admin', is_active: 1, email_confirmed: 1 });
    adminA = await User.findByIdWithPassword(adminA.id);
  }

  const agentA = await ensureUser({
    email: 'smoke.agent.a@local.test',
    name: 'Smoke Agent A',
    role: 'agent',
    ownerUserId: adminA.id
  });

  let adminB = await ensureUser({ email: 'smoke.admin.b@local.test', name: 'Smoke Admin B', role: 'admin' });
  if (Number(adminB.owner_user_id || 0) !== Number(adminB.id || 0)) {
    await User.update(adminB.id, { owner_user_id: adminB.id, role: 'admin', is_active: 1, email_confirmed: 1 });
    adminB = await User.findByIdWithPassword(adminB.id);
  }

  const leadA = await ensureLead({ phone: '5511910000001', name: 'Smoke Lead A', assignedTo: adminA.id, ownerUserId: adminA.id });
  const leadB = await ensureLead({ phone: '5511910000002', name: 'Smoke Lead B', assignedTo: adminB.id, ownerUserId: adminB.id });

  const sessionA = `owner_${adminA.id}_session`;
  await WhatsAppSession.upsertDispatchConfig(sessionA, {
    name: 'Smoke Session A',
    campaign_enabled: 1,
    daily_limit: 0,
    dispatch_weight: 1,
    owner_user_id: adminA.id,
    created_by: adminA.id
  });

  process.stdout.write(JSON.stringify({
    password: PASSWORD,
    users: {
      adminA: { email: adminA.email, id: Number(adminA.id) },
      agentA: { email: agentA.email, id: Number(agentA.id) },
      adminB: { email: adminB.email, id: Number(adminB.id) }
    },
    leads: {
      leadA: { id: Number(leadA.id) },
      leadB: { id: Number(leadB.id) }
    },
    sessionA
  }));
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
'@

$seed = Invoke-NodeScript -Script $seedScript

$outLog = Join-Path $env:TEMP 'zapvender-smoke-out.log'
$errLog = Join-Path $env:TEMP 'zapvender-smoke-err.log'
if (Test-Path $outLog) { Remove-Item $outLog -Force }
if (Test-Path $errLog) { Remove-Item $errLog -Force }

$proc = Start-Process node -ArgumentList 'server/start.js' -WorkingDirectory $workdir -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog

try {
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $health = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:3001/health' -TimeoutSec 2
            if ($health.status -eq 'healthy') {
                $ready = $true
                break
            }
        } catch {}
        Start-Sleep -Milliseconds 1000
    }

    if (-not $ready) {
        throw 'Server did not become healthy in time'
    }

    # /health fica disponivel antes do bootstrap terminar; aguarda um pouco para estabilizar pool/migracoes.
    Start-Sleep -Milliseconds 3000

    $loginAdminA = Invoke-LoginWithRetry -Email $seed.users.adminA.email -Password $seed.password
    $loginAgentA = Invoke-LoginWithRetry -Email $seed.users.agentA.email -Password $seed.password
    $loginAdminB = Invoke-LoginWithRetry -Email $seed.users.adminB.email -Password $seed.password

    $tokenAdminA = $loginAdminA.body.token
    $tokenAgentA = $loginAgentA.body.token
    $tokenAdminB = $loginAdminB.body.token

    $checks = @()

    $respBackdoor = Invoke-SmokeApi -Method 'POST' -Path '/api/auth/login' -Body @{ email = 'thyago'; password = 'thyago123' }
    $checks += [pscustomobject]@{ check = 'Legacy login blocked'; expected = 401; actual = $respBackdoor.status; ok = ($respBackdoor.status -eq 401) }

    $checks += [pscustomobject]@{ check = 'Admin A login'; expected = 200; actual = $loginAdminA.status; ok = ($loginAdminA.status -eq 200 -and -not [string]::IsNullOrWhiteSpace($tokenAdminA)) }
    $checks += [pscustomobject]@{ check = 'Agent A login'; expected = 200; actual = $loginAgentA.status; ok = ($loginAgentA.status -eq 200 -and -not [string]::IsNullOrWhiteSpace($tokenAgentA)) }
    $checks += [pscustomobject]@{ check = 'Admin B login'; expected = 200; actual = $loginAdminB.status; ok = ($loginAdminB.status -eq 200 -and -not [string]::IsNullOrWhiteSpace($tokenAdminB)) }

    $respSettingsAgent = Invoke-SmokeApi -Method 'PUT' -Path '/api/settings' -Token $tokenAgentA -Body @{ smoke_settings_probe = (Get-Date).ToString('o') }
    $checks += [pscustomobject]@{ check = 'Agent cannot update settings'; expected = 403; actual = $respSettingsAgent.status; ok = ($respSettingsAgent.status -eq 403) }

    $respSettingsAdmin = Invoke-SmokeApi -Method 'PUT' -Path '/api/settings' -Token $tokenAdminA -Body @{ smoke_settings_probe = (Get-Date).ToString('o') }
    $checks += [pscustomobject]@{ check = 'Admin can update settings'; expected = 200; actual = $respSettingsAdmin.status; ok = ($respSettingsAdmin.status -eq 200) }

    $respQueueAddAgentForbidden = Invoke-SmokeApi -Method 'POST' -Path '/api/queue/add' -Token $tokenAgentA -Body @{
        leadId = [int]$seed.leads.leadA.id
        content = 'smoke agent forbidden'
        mediaType = 'text'
        sessionId = $seed.sessionA
    }
    $checks += [pscustomobject]@{ check = 'Agent blocked from queue/add on non-assigned lead'; expected = 403; actual = $respQueueAddAgentForbidden.status; ok = ($respQueueAddAgentForbidden.status -eq 403) }

    $respQueueAddCrossOwner = Invoke-SmokeApi -Method 'POST' -Path '/api/queue/add' -Token $tokenAdminA -Body @{
        leadId = [int]$seed.leads.leadB.id
        content = 'smoke cross owner add'
        mediaType = 'text'
        sessionId = $seed.sessionA
    }
    $checks += [pscustomobject]@{ check = 'Owner A blocked on owner B lead (queue/add)'; expected = 403; actual = $respQueueAddCrossOwner.status; ok = ($respQueueAddCrossOwner.status -eq 403) }

    $respQueueBulkCrossOwner = Invoke-SmokeApi -Method 'POST' -Path '/api/queue/bulk' -Token $tokenAdminA -Body @{
        leadIds = @([int]$seed.leads.leadB.id)
        content = 'smoke cross owner bulk'
        options = @{ sessionId = $seed.sessionA }
    }
    $checks += [pscustomobject]@{ check = 'Owner A blocked on owner B lead (queue/bulk)'; expected = 403; actual = $respQueueBulkCrossOwner.status; ok = ($respQueueBulkCrossOwner.status -eq 403) }

    $respQueueAddAdmin = Invoke-SmokeApi -Method 'POST' -Path '/api/queue/add' -Token $tokenAdminA -Body @{
        leadId = [int]$seed.leads.leadA.id
        content = 'smoke admin allowed'
        mediaType = 'text'
        sessionId = $seed.sessionA
    }
    $queueId = 0
    if ($respQueueAddAdmin.body -and $respQueueAddAdmin.body.id) { $queueId = [int]$respQueueAddAdmin.body.id }
    $checks += [pscustomobject]@{ check = 'Admin queue/add on own lead'; expected = 200; actual = $respQueueAddAdmin.status; ok = ($respQueueAddAdmin.status -eq 200 -and $queueId -gt 0) }

    $respQueueStatus = Invoke-SmokeApi -Method 'GET' -Path '/api/queue/status' -Token $tokenAdminA
    $checks += [pscustomobject]@{ check = 'Admin queue/status'; expected = 200; actual = $respQueueStatus.status; ok = ($respQueueStatus.status -eq 200) }

    $respQueueCancelCrossOwner = Invoke-SmokeApi -Method 'DELETE' -Path ("/api/queue/{0}" -f $queueId) -Token $tokenAdminB
    $checks += [pscustomobject]@{ check = 'Owner B cannot cancel owner A queue item'; expected = 404; actual = $respQueueCancelCrossOwner.status; ok = ($respQueueCancelCrossOwner.status -eq 404) }

    $respQueueCancelOwner = Invoke-SmokeApi -Method 'DELETE' -Path ("/api/queue/{0}" -f $queueId) -Token $tokenAdminA
    $checks += [pscustomobject]@{ check = 'Owner A can cancel own queue item'; expected = 200; actual = $respQueueCancelOwner.status; ok = ($respQueueCancelOwner.status -eq 200) }

    $failed = @($checks | Where-Object { -not $_.ok })
    $summary = [pscustomobject]@{
        total = $checks.Count
        passed = @($checks | Where-Object { $_.ok }).Count
        failed = @($failed).Count
        debug = [pscustomobject]@{
            loginAdminA = $loginAdminA
            loginAgentA = $loginAgentA
            loginAdminB = $loginAdminB
        }
        checks = $checks
    }

    $summary | ConvertTo-Json -Depth 6

    if (@($failed).Count -gt 0) {
        exit 2
    }
} finally {
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force
    }
}
