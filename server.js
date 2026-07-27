/**
 * ENGINE_API_V1 V1_FINAL CORRIGIDO - ESM (type: module)
 * Compatível com package.json "type": "module"
 * Aceita { jogo } OU { dezenas }
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const MINI_PATH = path.join(__dirname, 'private', 'MINI_SECA.txt');
const SHA_ESPERADO = 'f1a336f18f35afd0680023872448937a73307e0e896b6d9a818985899950cf5a';

console.log('=== ENGINE_API_V1 V1_FINAL CORRIGIDO ESM INICIANDO ===');
console.log('MINI_PATH:', MINI_PATH);

if (!fs.existsSync(MINI_PATH)) {
  console.error('ERRO: MINI_SECA.txt não encontrada em', MINI_PATH);
  process.exit(1);
}

const miniRaw = fs.readFileSync(MINI_PATH, 'utf8');
const sha = crypto.createHash('sha256').update(miniRaw).digest('hex');
console.log('SHA MINI:', sha);
console.log('SHA esperado:', SHA_ESPERADO);

const jogos = miniRaw.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const nums = l.split(/[,\s;]+/).map(n => parseInt(n,10)).filter(n=>n>=1&&n<=25);
  return nums;
}).filter(a=>a.length===15);

console.log(`MINI carregada: ${jogos.length} jogos em RAM`);

const jogosMasks = jogos.map(arr => {
  let m = 0n;
  for (const n of arr) m |= 1n << BigInt(n-1);
  return m;
});

function toMask(arr){ let m=0n; for(const n of arr) m|=1n<<BigInt(n-1); return m; }
function popcountBigInt(n){ let c=0; while(n){ c+= Number(n & 1n); n >>= 1n; } return c; }
function validarJogo(arr){
  if(!Array.isArray(arr)) return false;
  if(arr.length!==15) return false;
  const set = new Set(arr);
  if(set.size!==15) return false;
  for(const v of arr){ if(!Number.isInteger(v)||v<1||v>25) return false; }
  return true;
}

app.get('/api/health', (req,res)=>{
  res.json({
    status:'online',
    engine:'ENGINE_API_V1',
    version:'1.0 CORRIGIDO ESM jogo||dezenas',
    sha_mini: sha,
    total_jogos: jogos.length,
    sha_ok: sha===SHA_ESPERADO
  });
});

app.post('/api/consultar', (req,res)=>{
  // CORREÇÃO CONTRATO
  const jogo = req.body.jogo || req.body.dezenas;
  const faixasSolicitadas = req.body.faixas || null;

  if (!jogo) {
    return res.status(400).json({ error: "Envie 15 dezenas únicas entre 1 e 25" });
  }
  if (!validarJogo(jogo)) {
    return res.status(400).json({ error: "Envie 15 dezenas únicas entre 1 e 25" });
  }

  const consultaId = crypto.randomUUID();
  const maskConsulta = toMask(jogo);

  const faixas = { "11":0, "12":0, "13":0, "14":0, "15":0 };
  const filtrados = { "11":[], "12":[], "13":[], "14":[], "15":[] };

  for(let i=0;i<jogosMasks.length;i++){
    const inter = jogosMasks[i] & maskConsulta;
    const acertos = popcountBigInt(inter);
    if(acertos>=11){
      const k = String(acertos);
      if(faixas[k]!==undefined){
        faixas[k]++;
        if(acertos>=12 || (acertos===11 && filtrados["11"].length<5000)){
          filtrados[k].push(i);
        }
      }
    }
  }

  if(!global._consultas) global._consultas = new Map();
  global._consultas.set(consultaId, {
    jogo,
    faixas,
    filtradosIndices: filtrados,
    faixasSolicitadas,
    created: Date.now(),
    sha
  });
  for(const [id, data] of global._consultas.entries()){
    if(Date.now()-data.created > 10*60*1000) global._consultas.delete(id);
  }

  res.json({
    consulta_id: consultaId,
    faixas,
    sha_mini: sha,
    total_mini: jogos.length
  });
});

app.post('/api/download', (req,res)=>{
  const { consulta_id, faixa } = req.body;
  if(!consulta_id || !faixa) return res.status(400).json({ error: "consulta_id e faixa obrigatórios" });
  const consulta = global._consultas?.get(consulta_id);
  if(!consulta) return res.status(404).json({ error: "Consulta expirada ou não encontrada (10min)" });

  const indices = consulta.filtradosIndices[faixa];
  if(!indices) return res.status(400).json({ error: "Faixa inválida" });

  const linhas = indices.map(idx => jogos[idx].join(','));
  const conteudo = `MINI_SECA 81.491 - RESULTADO FILTRADO\nConsulta ID: ${consulta_id}\nJogo consultado: ${consulta.jogo.join(',')}\nFaixa: ${faixa} pontos\nEncontrados: ${linhas.length}\nSHA MINI: ${consulta.sha}\nMINI original permanece protegida no servidor\nGerado: ${new Date().toISOString()}\n\n${linhas.join('\n')}`;

  res.setHeader('Content-Type','text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="MINI_FILTRADO_${faixa}_${consulta_id.slice(0,8)}.txt"`);
  res.send(conteudo);
});

app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, ()=>{
  console.log(`ENGINE_API_V1 V1_FINAL CORRIGIDO ESM rodando: http://localhost:${PORT}`);
});
