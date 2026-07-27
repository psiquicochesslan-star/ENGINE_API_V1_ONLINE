const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Carrega MINI
const miniPath = path.join(__dirname, 'private', 'MINI_SECA.txt');
let MINI = [];
let MINI_SHA = '';

try {
  const raw = fs.readFileSync(miniPath, 'utf8');
  MINI = raw.split('\n').map(l=>l.trim()).filter(l=>l.length>0).map(l=> l.split(/[\s,;]+/).map(Number).filter(n=>n>=1&&n<=25));
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  MINI_SHA = hash;
  console.log(`MINI carregada: ${MINI.length} jogos em RAM`);
  console.log(`SHA MINI: ${MINI_SHA}`);
} catch(e){
  console.error('ERRO ao carregar MINI:', e.message);
}

app.use((req,res,next)=>{
  res.header('Access-Control-Allow-Origin','*');
  res.header('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/api/stats', (req,res)=>{
  res.json({ total: MINI.length, sha: MINI_SHA, mini_sha: MINI_SHA, status: 'ONLINE', engine: 'V1_FINAL' });
});
app.get('/stats', (req,res)=>{
  res.json({ total: MINI.length, sha: MINI_SHA, mini_sha: MINI_SHA, status: 'ONLINE', engine: 'V1_FINAL' });
});

app.post('/api/consultar', (req,res)=>{
  try{
    const dezenas = (req.body.dezenas||[]).map(Number);
    if(dezenas.length!==15) return res.status(400).json({error:'Precisa 15 dezenas'});
    const setSorteio = new Set(dezenas);
    let c15=0,c14=0,c13=0,c12=0,c11=0;
    for(const jogo of MINI){
      let acertos=0;
      for(const n of jogo){ if(setSorteio.has(n)) acertos++; }
      if(acertos===15) c15++; else if(acertos===14) c14++; else if(acertos===13) c13++; else if(acertos===12) c12++; else if(acertos===11) c11++;
    }
    res.json({ totais:{'15':c15,'14':c14,'13':c13,'12':c12,'11':c11}, c14,c13,c12,c11, '15p':c15,'14p':c14,'13p':c13,'12p':c12,'11p':c11, consultaId:'MS-'+Date.now().toString(36).toUpperCase(), timestamp:new Date().toISOString() });
  }catch(e){ res.status(500).json({error:e.message}); }
});
app.post('/consultar', (req,res)=>{ res.redirect(307, '/api/consultar'); });

app.get('/', (req,res)=>{ res.sendFile(path.join(__dirname,'public','index.html')); });
app.listen(PORT, ()=>{ console.log(`ENGINE ONLINE na porta ${PORT}`); });
