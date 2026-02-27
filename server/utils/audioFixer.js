/**
 * SELF PROTEÇÃO VEICULAR - Audio Fixer
 * Corrige problemas comuns de áudio identificados nos projetos GitHub
 * Baseado em análise de: WhiskeySockets/Baileys, yury-tomaz/whatsapp-api-baileys
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class AudioFixer {
    constructor() {
        // Formatos suportados e suas compatibilidades
        this.supportedFormats = {
            'audio/ogg; codecs=opus': { 
                extension: '.ogg', 
                compatible: ['android', 'web'],
                ptt: true 
            },
            'audio/mp4': { 
                extension: '.mp4', 
                compatible: ['ios', 'android', 'web', 'windows'],
                ptt: true 
            },
            'audio/mpeg': { 
                extension: '.mp3', 
                compatible: ['all'],
                ptt: false 
            },
            'audio/aac': { 
                extension: '.aac', 
                compatible: ['ios', 'android'],
                ptt: false 
            }
        };

        // Formato padrão mais compatível
        this.defaultFormat = 'audio/ogg; codecs=opus';
        this.fallbackFormat = 'audio/mp4';
    }

    /**
     * Valida e corrige formato de áudio antes de enviar
     * Corrige problema: "Audio not available" e playback em iOS/Windows
     */
    async validateAndFixAudio(audioPath, options = {}) {
        try {
            // Verificar se arquivo existe
            if (!fs.existsSync(audioPath)) {
                throw new Error('Arquivo de áudio não encontrado');
            }

            const stats = fs.statSync(audioPath);
            
            // Validar tamanho (máximo 16MB para WhatsApp)
            if (stats.size > 16 * 1024 * 1024) {
                throw new Error('Arquivo muito grande (máximo 16MB)');
            }

            if (stats.size === 0) {
                throw new Error('Arquivo vazio');
            }

            // Detectar formato atual
            const currentMime = options.mimetype || this.detectMimeType(audioPath);
            
            // Verificar compatibilidade
            const formatInfo = this.supportedFormats[currentMime];
            
            if (!formatInfo) {
                console.warn(`[AudioFixer] Formato ${currentMime} não suportado, usando padrão`);
                return {
                    path: audioPath,
                    mimetype: this.defaultFormat,
                    ptt: options.ptt !== undefined ? options.ptt : true,
                    needsConversion: false,
                    warning: 'Formato não suportado, usando padrão'
                };
            }

            // Verificar se precisa conversão para melhor compatibilidade
            const needsConversion = options.forceCompatible && 
                                   !formatInfo.compatible.includes('all') &&
                                   !formatInfo.compatible.includes('ios');

            return {
                path: audioPath,
                mimetype: currentMime,
                ptt: options.ptt !== undefined ? options.ptt : formatInfo.ptt,
                needsConversion,
                size: stats.size,
                duration: options.duration || null
            };
        } catch (error) {
            console.error('[AudioFixer] Erro ao validar áudio:', error.message);
            throw error;
        }
    }

    /**
     * Detecta MIME type baseado na extensão
     */
    detectMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeMap = {
            '.ogg': 'audio/ogg; codecs=opus',
            '.mp4': 'audio/mp4',
            '.m4a': 'audio/mp4',
            '.mp3': 'audio/mpeg',
            '.aac': 'audio/aac',
            '.wav': 'audio/wav'
        };
        return mimeMap[ext] || this.defaultFormat;
    }

    /**
     * Prepara áudio para envio com fallback
     * Corrige problema: PTT waveform desaparece
     */
    async prepareAudioForSend(audioPath, options = {}) {
        try {
            const validated = await this.validateAndFixAudio(audioPath, options);
            
            // Se precisa conversão e temos ffmpeg disponível
            if (validated.needsConversion && this.hasFFmpeg()) {
                const converted = await this.convertAudio(audioPath, this.fallbackFormat);
                return {
                    ...validated,
                    path: converted,
                    mimetype: this.fallbackFormat
                };
            }

            // Garantir que PTT está configurado corretamente
            const audioOptions = {
                mimetype: validated.mimetype,
                ptt: validated.ptt,
                seconds: validated.duration || null
            };

            // Adicionar waveform se disponível (corrige problema de waveform desaparecer)
            if (validated.ptt && options.waveform) {
                audioOptions.waveform = options.waveform;
            }

            return {
                ...validated,
                options: audioOptions
            };
        } catch (error) {
            console.error('[AudioFixer] Erro ao preparar áudio:', error.message);
            throw error;
        }
    }

    /**
     * Verifica se ffmpeg está disponível
     */
    hasFFmpeg() {
        try {
            const { execSync } = require('child_process');
            execSync('ffmpeg -version', { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Converte áudio para formato compatível
     * Requer ffmpeg instalado
     */
    async convertAudio(inputPath, targetFormat) {
        if (!this.hasFFmpeg()) {
            throw new Error('ffmpeg não está instalado. Instale para conversão de áudio.');
        }

        const { execSync } = require('child_process');
        const outputPath = inputPath.replace(/\.[^.]+$/, 
            this.supportedFormats[targetFormat]?.extension || '.ogg'
        );

        try {
            // Converter usando ffmpeg
            const command = `ffmpeg -i "${inputPath}" -vn -acodec libopus -b:a 64k "${outputPath}" -y`;
            execSync(command, { stdio: 'ignore' });
            
            return outputPath;
        } catch (error) {
            console.error('[AudioFixer] Erro na conversão:', error.message);
            throw new Error('Falha ao converter áudio');
        }
    }

    /**
     * Valida URL de áudio antes de download
     * Corrige problema: URLs inválidas causando "Audio not available"
     */
    async validateAudioUrl(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            
            const request = protocol.get(url, { timeout: 5000 }, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                const contentType = response.headers['content-type'] || '';
                const isValidAudio = contentType.startsWith('audio/') || 
                                   url.match(/\.(ogg|mp3|mp4|m4a|aac|wav)/i);

                if (!isValidAudio) {
                    reject(new Error('URL não é um arquivo de áudio válido'));
                    return;
                }

                resolve({
                    valid: true,
                    contentType,
                    size: parseInt(response.headers['content-length'] || '0')
                });
            });

            request.on('error', (err) => {
                reject(new Error(`Erro ao validar URL: ${err.message}`));
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Timeout ao validar URL'));
            });
        });
    }

    /**
     * Gera waveform para PTT (corrige problema de waveform desaparecer)
     */
    generateWaveform(audioBuffer) {
        // Implementação simples de waveform
        // Em produção, usar biblioteca dedicada
        const samples = 64;
        const waveform = [];
        const chunkSize = Math.floor(audioBuffer.length / samples);

        for (let i = 0; i < samples; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, audioBuffer.length);
            let sum = 0;

            for (let j = start; j < end; j++) {
                sum += Math.abs(audioBuffer[j]);
            }

            waveform.push(Math.floor((sum / chunkSize) * 100));
        }

        return Buffer.from(waveform);
    }

    /**
     * Corrige problemas comuns de áudio recebido
     */
    async fixReceivedAudio(audioMessage) {
        try {
            // Validar URL
            if (!audioMessage.url) {
                throw new Error('URL de áudio não fornecida');
            }

            await this.validateAudioUrl(audioMessage.url);

            // Garantir formato compatível
            const mimetype = audioMessage.mimetype || this.defaultFormat;
            const formatInfo = this.supportedFormats[mimetype];

            if (!formatInfo) {
                console.warn(`[AudioFixer] Formato recebido ${mimetype} não suportado`);
            }

            return {
                ...audioMessage,
                mimetype: formatInfo ? mimetype : this.defaultFormat,
                validated: true
            };
        } catch (error) {
            console.error('[AudioFixer] Erro ao corrigir áudio recebido:', error.message);
            throw error;
        }
    }
}

module.exports = new AudioFixer();
module.exports.AudioFixer = AudioFixer;
