
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({limit: '2mb'}));
app.use(express.static(path.join(__dirname, 'public')));

// CORS
app.use((req,res,next)=>{
  res.header('Access-Control-Allow-Origin','*');
  res.header('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.sendStatus(200);
  next();
});

const miniPath = path.join(__dirname, 'private', 'MINI_SECA.txt');
let MINI = [];
let MINI_SHA = '';
let MINI_RAW = '';

try{
  MINI_RAW = fs.readFileSync(miniPath, 'utf8');
  MINI = MINI_RAW.split('\n').map(l=>l.trim()).filter(Boolean).map(l=> l.split(/[\s,;]+/).map(Number).filter(n=>n>=1&&n<=25));
  MINI_SHA = crypto.createHash('sha256').update(MINI_RAW).digest('hex');
  console.log(`MINI carregada: ${MINI.length} jogos`);
  console.log(`SHA: ${MINI_SHA}`);
}catch(e){
  console.error('ERRO MINI:', e.message);
}

// Memoria de consultas para download
const CONSULTAS = new Map();

function consultar(dezenas){
  const set = new Set(dezenas);
  const porFaixa = { '15': [], '14': [], '13': [], '12': [], '11': [] };
  let c15=0,c14=0,c13=0,c12=0,c11=0;
  for(const jogo of MINI){
    let ac=0;
    for(const n of jogo){ if(set.has(n)) ac++; }
    if(ac===15){ c15++; porFaixa['15'].push(jogo); }
    else if(ac===14){ c14++; porFaixa['14'].push(jogo); }
    else if(ac===13){ c13++; porFaixa['13'].push(jogo); }
    else if(ac===12){ c12++; porFaixa['12'].push(jogo); }
    else if(ac===11){ c11++; porFaixa['11'].push(jogo); }
  }
  return { c15,c14,c13,c12,c11, porFaixa };
}

app.get('/api/health', (req,res)=>{
  res.json({ status:'ONLINE', total: MINI.length, sha: MINI_SHA, mini_sha: MINI_SHA, engine:'V1_FINAL' });
});
app.get('/api/stats', (req,res)=>{
  res.json({ total: MINI.length, sha: MINI_SHA, mini_sha: MINI_SHA, status:'ONLINE', engine:'V1_FINAL' });
});
app.get('/stats', (req,res)=>{
  res.json({ total: MINI.length, sha: MINI_SHA, mini_sha: MINI_SHA, status:'ONLINE' });
});

app.post('/api/consultar', (req,res)=>{
  try{
    const dezenas = (req.body.dezenas||[]).map(Number);
    if(dezenas.length!==15) return res.status(400).json({error:'15 dezenas'});
    const {c15,c14,c13,c12,c11, porFaixa} = consultar(dezenas);
    const consulta_id = 'MS-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
    CONSULTAS.set(consulta_id, { dezenas, porFaixa, ts: Date.now() });
    // limpa antigas >30min
    for(const [k,v] of CONSULTAS){ if(Date.now()-v.ts>30*60*1000) CONSULTAS.delete(k); }
    res.json({
      consulta_id,
      consultaId: consulta_id,
      totais: { '15': c15, '14': c14, '13': c13, '12': c12, '11': c11 },
      total: MINI.length,
      '15': c15, '14': c14, '13': c13, '12': c12, '11': c11,
      c15,c14,c13,c12,c11,
      '15p': c15,'14p': c14,'13p': c13,'12p': c12,'11p': c11,
      jogosReaisPorFaixa: porFaixa,
      jogosPorFaixa: porFaixa,
      timestamp: new Date().toISOString(),
      sha: MINI_SHA
    });
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/download', (req,res)=>{
  try{
    const { consulta_id, consultaId, faixa } = req.body;
    const id = consulta_id || consultaId;
    const f = String(faixa);
    if(!id || !f) return res.status(400).json({error:'consulta_id e faixa obrigatorios'});
    const mem = CONSULTAS.get(id);
    if(!mem){
      // Se não achar na memoria, tenta aceitar que o frontend já tem os jogos e retorna 404 para usar fallback
      return res.status(404).json({error:'Consulta expirada, use fallback jogosReaisPorFaixa'});
    }
    const jogos = mem.porFaixa[f] || [];
    const txt = jogos.map(j=> j.map(n=>String(n).padStart(2,'0')).join(' ')).join('\n');
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="resultado_${f}pts_${id.slice(0,8)}.txt"`);
    res.send(txt);
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Fallback consulta sem /api
app.post('/consultar', (req,res)=>{ req.url='/api/consultar'; app.handle(req,res); });

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, ()=> console.log(`ENGINE V7.6 ONLINE porta ${PORT}`));
