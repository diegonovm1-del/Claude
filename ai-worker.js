/* Worker da IA: roda o WebLLM fora da tela principal para o app não travar
   enquanto o modelo carrega ou responde. */
import { WebWorkerMLCEngineHandler } from './webllm.js';
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = msg => handler.onmessage(msg);
