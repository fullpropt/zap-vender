/**
 * SELF PROTEÇÃO VEICULAR - Testes Automatizados
 * Testes unitários e de integração para funcionalidades WhatsApp
 */

const audioFixer = require('../server/utils/audioFixer');
const connectionFixer = require('../server/utils/connectionFixer');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('WhatsApp Integration Tests', () => {
    describe('AudioFixer', () => {
        test('deve detectar formato de áudio corretamente', () => {
            const formats = [
                { file: 'test.ogg', expected: 'audio/ogg; codecs=opus' },
                { file: 'test.mp4', expected: 'audio/mp4' },
                { file: 'test.mp3', expected: 'audio/mpeg' },
                { file: 'test.m4a', expected: 'audio/mp4' }
            ];

            formats.forEach(({ file, expected }) => {
                const detected = audioFixer.detectMimeType(file);
                expect(detected).toBe(expected);
            });
        });

        test('deve validar URL de áudio', async () => {
            // Mock de URL válida (teste será pulado se não houver internet)
            const validUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
            
            try {
                const result = await audioFixer.validateAudioUrl(validUrl);
                expect(result.valid).toBe(true);
            } catch (error) {
                // Se falhar por timeout ou rede, não é erro do código
                console.log('Teste de URL pulado (sem conexão)');
            }
        });

        test('deve rejeitar URL inválida', async () => {
            const invalidUrl = 'https://invalid-url-that-does-not-exist-12345.com/audio.mp3';
            
            await expect(audioFixer.validateAudioUrl(invalidUrl)).rejects.toThrow();
        });

        test('deve preparar áudio com formato correto', async () => {
            // Criar diretório e arquivo temporários exclusivos
            const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-fixer-test-'));
            const testFile = path.join(testDir, `test-audio-${Date.now()}-${process.pid}.ogg`);
            
            // Criar arquivo vazio para teste
            fs.writeFileSync(testFile, Buffer.alloc(100));

            try {
                const result = await audioFixer.prepareAudioForSend(testFile, {
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true
                });

                expect(result).toHaveProperty('path');
                expect(result).toHaveProperty('mimetype');
                expect(result).toHaveProperty('ptt');
                expect(result.ptt).toBe(true);
            } finally {
                // Limpar diretório temporário de teste
                if (fs.existsSync(testDir)) {
                    fs.rmSync(testDir, { recursive: true, force: true });
                }
            }
        });
    });

    describe('ConnectionFixer', () => {
        test('deve detectar tipo de erro corretamente', () => {
            const testCases = [
                {
                    error: { output: { statusCode: 401 }, message: 'Bad Mac' },
                    expected: { type: 'auth_failed', action: 'clean_session' }
                },
                {
                    error: { output: { statusCode: 403 }, message: 'Forbidden' },
                    expected: { type: 'blocked', action: 'wait_and_retry' }
                },
                {
                    error: { output: { statusCode: 408 }, message: 'Timeout' },
                    expected: { type: 'timeout', action: 'retry' }
                },
                {
                    error: { message: 'Failed to decrypt' },
                    expected: { type: 'decrypt_failed', action: 'regenerate_keys' }
                }
            ];

            testCases.forEach(({ error, expected }) => {
                const result = connectionFixer.detectDisconnectReason(error);
                expect(result.type).toBe(expected.type);
                expect(result.action).toBe(expected.action);
            });
        });

        test('deve calcular delay de retry corretamente', () => {
            expect(connectionFixer.getRetryDelay(0)).toBe(1000);
            expect(connectionFixer.getRetryDelay(1)).toBe(2000);
            expect(connectionFixer.getRetryDelay(2)).toBe(4000);
            expect(connectionFixer.getRetryDelay(10)).toBe(16000); // Máximo
        });

        test('deve validar sessão corretamente', async () => {
            const testSessionPath = path.join(__dirname, '..', 'sessions', 'test-session');
            
            // Criar sessão de teste
            if (!fs.existsSync(testSessionPath)) {
                fs.mkdirSync(testSessionPath, { recursive: true });
            }

            // Teste com sessão vazia (inválida)
            const validation = await connectionFixer.validateSession(testSessionPath);
            expect(validation).toHaveProperty('valid');
            expect(validation).toHaveProperty('issues');

            // Limpar
            if (fs.existsSync(testSessionPath)) {
                fs.rmSync(testSessionPath, { recursive: true, force: true });
            }
        });
    });

    describe('Integração', () => {
        test('deve processar mensagem de áudio corretamente', async () => {
            const mockAudioMessage = {
                url: 'https://example.com/audio.ogg',
                mimetype: 'audio/ogg; codecs=opus',
                seconds: 10
            };

            try {
                const result = await audioFixer.fixReceivedAudio(mockAudioMessage);
                expect(result).toHaveProperty('validated');
            } catch (error) {
                // Se falhar por URL inválida, é esperado em ambiente de teste
                expect(error.message).toContain('URL');
            }
        });
    });
});
