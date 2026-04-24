const {createClient} = supabase;
const SB = createClient(
  'https://mqfyuprpztiyfpleannt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZnl1cHJwenRpeWZwbGVhbm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjg3MjUsImV4cCI6MjA4OTkwNDcyNX0.4Fvc-fNlwhVp0HvOEL-Z92i9W4YvVSAgen0ihBzlGOk'
);
const SRC=['PayPal','Oney','Cofidis','Carte bancaire','Virement','Prélèvement','Autre'];

// PIN
let pv='', pinMoi='0000', pinCop='0000';
// Charger PIN et photo de fond au démarrage
(async()=>{
  const {data}=await SB.from('app_config').select('key,value').in('key',['pin','pin_moi','pin_copine','bg_photo']);
  if(data){
    const pin=data.find(d=>d.key==='pin');
    const pm=data.find(d=>d.key==='pin_moi');
    const pcfg=data.find(d=>d.key==='pin_copine');
    const bg=data.find(d=>d.key==='bg_photo');
    if(pm&&pm.value) pinMoi=pm.value;
    if(pcfg&&pcfg.value) pinCop=pcfg.value;
    if(pin&&pin.value&&!pm&&!pcfg){pinMoi=pin.value;pinCop=pin.value;}
    if(bg&&bg.value) applyBg(bg.value);
  }
})();

function applyBg(dataUrl){
  if(!dataUrl) return;
  const ps=document.getElementById('pin-screen');
  if(ps){
    ps.style.backgroundImage=`url(${dataUrl})`;
    ps.style.backgroundSize='cover';
    ps.style.backgroundPosition='center';
    // Overlay sombre pour garder la lisibilité
    ps.style.backgroundColor='transparent';
    const overlay=document.getElementById('pin-overlay');
    if(overlay) overlay.style.display='flex';
  }
}

function PK(n){if(pv.length>=4)return;pv+=n;PR();if(pv.length===4)setTimeout(PC,100);}
function PD(){pv=pv.slice(0,-1);PR();document.getElementById('pin-err').textContent='';}

// iOS Safari fix: use touchstart + preventDefault to avoid 300ms delay and ghost clicks
document.addEventListener('DOMContentLoaded', function() {
  const pad = document.getElementById('pin-pad');
  if (!pad) return;
  function handlePin(e) {
    const btn = e.target.closest('[data-k]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const k = btn.getAttribute('data-k');
    if (k === 'del') PD();
    else PK(k);
    btn.style.background = 'rgba(255,255,255,.3)';
    setTimeout(() => btn.style.background = '', 150);
  }
  pad.addEventListener('touchstart', handlePin, {passive: false});
  pad.addEventListener('click', handlePin);
});
function PR(){for(let i=0;i<4;i++)document.getElementById('pd'+i).className='pin-dot'+(i<pv.length?' on':'');}
function roleForPin(code){
  if(code===pinMoi)return 'Moi';
  if(code===pinCop)return 'Copine';
  return null;
}
async function PC(){
  const {data}=await SB.from('app_config').select('key,value').in('key',['pin','pin_moi','pin_copine']);
  if(data){
    const p=data.find(d=>d.key==='pin');
    const pm=data.find(d=>d.key==='pin_moi');
    const pcfg=data.find(d=>d.key==='pin_copine');
    if(pm&&pm.value)pinMoi=pm.value;
    if(pcfg&&pcfg.value)pinCop=pcfg.value;
    if(p&&p.value&&!pm&&!pcfg){pinMoi=p.value;pinCop=p.value;}
  }
  const role=roleForPin(pv);
  if(role){
    G.user_role=role;
    document.getElementById('pin-screen').style.display='none';
    document.getElementById('app').style.display='block';
    AI();
  }else{
    document.getElementById('pin-err').textContent='Code incorrect';
    pv='';PR();
  }
}

// STATE

let G={rows:[],archive_rows:[],tab:'all',comp:false,email:'',fa:'tous',fcat:'tous',fs:'tous',fq:'',tri:'date',eid:null,pid:null,pm:false,sm:false,sf:false,lm:false,user_role:'',logs:[],cfa:'tous',abos:[],eabo:null,cats:[],salaire:0,cop_credit:{},cal:{y:new Date().getFullYear(),m:new Date().getMonth(),sel:null}};

function applyLiveSearch(){
  const q=(G.fq||'').trim().toLowerCase();
  const cards=[...document.querySelectorAll('.card[data-search]')];
  const trs=[...document.querySelectorAll('tr[data-search]')];
  let vc=0,vt=0;
  cards.forEach(el=>{
    const ok=!q||el.dataset.search.includes(q);
    el.style.display=ok?'':'none';
    if(ok)vc++;
  });
  trs.forEach(el=>{
    const ok=!q||el.dataset.search.includes(q);
    el.style.display=ok?'':'none';
    if(ok)vt++;
  });
  const ec=document.getElementById('cards-live-empty');
  const et=document.getElementById('table-live-empty');
  if(ec)ec.style.display=(cards.length>0&&vc===0)?'block':'none';
  if(et)et.style.display=(trs.length>0&&vt===0)?'block':'none';
}

function Q(el){
  G.fq=el.value;
  applyLiveSearch();
}

function RF(){
  G.fa='tous';
  G.fcat='tous';
  G.fs='tous';
  G.fq='';
  G.tri='date';
  render();
}

async function loadLogs(){
  if(G.user_role!=='Moi'){G.logs=[];return;}
  const {data,error}=await SB.from('payment_logs').select('*').order('created_at',{ascending:false}).limit(200);
  if(error){G.logs=[];return;}
  G.logs=data||[];
}
async function logPayment({actionType,marchand,echeanceId,amount,note}){
  const row={
    actor:G.user_role||'Moi',
    action_type:actionType,
    marchand:marchand||'',
    echeance_id:echeanceId||null,
    amount:Math.round((parseFloat(amount)||0)*100)/100,
    note:note||''
  };
  await SB.from('payment_logs').insert(row);
}

function getCopCredit(id){
  return parseFloat((G.cop_credit||{})[id]||0);
}
function setCopCredit(id,val){
  if(!G.cop_credit)G.cop_credit={};
  G.cop_credit[id]=Math.round((parseFloat(val)||0)*100)/100;
}
async function saveCopCredit(){
  await SB.from('app_config').upsert({key:'cop_credit_map',value:JSON.stringify(G.cop_credit||{})});
}


async function LD(){
  const [{data:d1,error:e1},{data:d2},{data:d3},{data:d4},{data:d5},{data:d6},{data:d7}]=await Promise.all([
    SB.from('echeances').select('*').eq('archive',false).order('due'),
    SB.from('abonnements').select('*').order('nom'),
    SB.from('categories').select('*').order('nom'),
    SB.from('app_config').select('key,value').eq('key','salaire_brut').single(),
    SB.from('echeances').select('*').eq('archive',true).order('created_at',{ascending:false}),
    SB.from('app_config').select('key,value').eq('key','email_rappel').single(),
    SB.from('app_config').select('key,value').eq('key','cop_credit_map').single()
  ]);
  if(e1){T('Erreur: '+e1.message);return;}
  G.rows=d1||[];
  G.abos=d2||[];
  G.cats=d3||[];
  G.salaire=parseFloat(d4?.value||0);
  G.archive_rows=d5||[];
  G.email=d6?.value||'';
  try{G.cop_credit=d7?.value?JSON.parse(d7.value):{};}catch(e){G.cop_credit={};}
}

async function AI(){
  await LD();
  await loadLogs();
  render();
}

function f(n){return Number(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';}
function addM(s){const d=new Date(s+'T12:00:00');d.setMonth(d.getMonth()+1);return d.toISOString().split('T')[0];}
function fd(s){return new Date(s+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});}
function fdf(s){return new Date(s+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});}
function mn(off=0){const d=new Date();if(off)d.setMonth(d.getMonth()+off);return d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});}

function gv(r,i){
  // Si perso et données disponibles, utiliser le montant perso
  if(r.versement_type==='perso'&&r.versements_perso&&r.versements_perso[i]&&parseFloat(r.versements_perso[i].montant))
    return parseFloat(r.versements_perso[i].montant);
  // Sinon fallback sur versement égal
  return parseFloat(r.versement)||0;
}
function gc(r,i){
  if(!r.partage)return 0;
  const v=gv(r,i);
  if(r.partage_type==='perso'&&r.versements_perso&&r.versements_perso[i]&&parseFloat(r.versements_perso[i].copine_montant))
    return parseFloat(r.versements_perso[i].copine_montant);
  return v/2;
}
function sumInstAmounts(r,start,count){
  let t=0;
  const end=Math.min(r.total_inst,start+count);
  for(let i=start;i<end;i++)t+=gv(r,i);
  return Math.round(t*100)/100;
}
function sumCopShares(r,start,count){
  let t=0;
  const end=Math.min(r.total_inst,start+count);
  for(let i=start;i<end;i++)t+=gc(r,i);
  return Math.round(t*100)/100;
}
function nextDueAfter(r,newPays){
  if(newPays>=r.total_inst)return null;
  const d=new Date(r.due+'T12:00:00');
  d.setMonth(d.getMonth()+(newPays-r.pays));
  return d.toISOString().split('T')[0];
}
function calc(r){
  const rest=r.total_inst-r.pays;
  let total=0,deja=0,restant=0;
  let futureCop=0;
  if(r.versement_type==='perso'&&r.versements_perso&&r.versements_perso.length){
    for(let i=0;i<r.total_inst;i++){
      const v=gv(r,i);
      total+=v;
      if(i<r.pays)deja+=v;
      else{
        restant+=v;
        if(r.partage)futureCop+=gc(r,i);
      }
    }
  }else{
    const v=parseFloat(r.versement)||0;
    total=parseFloat(r.montant_total)||v*r.total_inst;
    deja=v*r.pays;restant=v*rest;
    if(r.partage)futureCop=restant/2;
  }
  const hasSavedBal=r.partage&&Object.prototype.hasOwnProperty.call(G.cop_credit||{},r.id);
  const bal=r.partage?(hasSavedBal?getCopCredit(r.id):futureCop):0;
  const pc2=Math.max(0,bal);
  const today=new Date();today.setHours(0,0,0,0);
  const due=new Date(r.due+'T12:00:00');
  const j=Math.round((due-today)/86400000);
  const st=rest===0?'soldé':j<0?'retard':j<=7?'urgent':'ok';
  const lp=r.last_paid_date?new Date(r.last_paid_date+'T12:00:00'):null;
  const nk=new Date().getMonth()+'-'+new Date().getFullYear();
  const lk=lp?(lp.getMonth()+'-'+lp.getFullYear()):'';
  const pd2=(lk===nk)||rest===0;
  const pdCop = !r.partage || pc2<=0 || rest===0;
  const nextCopPart = rest>0?gc(r,r.pays):0;
  const cc = r.partage?nextCopPart:0;
  return{rest,total,deja,restant,pc:pc2,j,st,pd:pd2,pdCop,cv:gv(r,r.pays),cc};
}

function aboForMonth(y,m){
  // Retourne les abonnements actifs pour un mois/an donné
  // Un abo actif = prélèvement ce mois là
  const mi=[],co=[];
  (G.abos||[]).filter(a=>a.actif).forEach(a=>{
    const amt=parseFloat(a.montant)||0;
    const mc=a.partage?(a.partage_type==='perso'?parseFloat(a.montant_copine||0):amt/2):0;
    if(a.partage){
      mi.push({n:a.nom,m:amt-mc,p:true,abo:true});
      co.push({n:a.nom,m:mc,p:true,abo:true});
    } else if(a.acheteur==='Moi'){
      mi.push({n:a.nom,m:amt,p:false,abo:true});
    } else {
      co.push({n:a.nom,m:amt,p:false,abo:true});
    }
  });
  return{mi,co};
}

function GMD(y,m){
  const s=new Date(y,m,1,0,0,0);
  const e=new Date(y,m+1,0,23,59,59);
  const mi=[],co=[];
  const now=new Date(); now.setHours(0,0,0,0);
  const curY=now.getFullYear(), curM=now.getMonth();
  const isFuture=(y>curY)||(y===curY&&m>curM);

  G.rows.forEach(r=>{
    const c=calc(r);if(c.st==='soldé')return;

    if(isFuture){
      // Pour les mois futurs : simuler les versements restants
      const rest=r.total_inst-r.pays;
      for(let p=0;p<rest;p++){
        const dd=new Date(r.due+'T12:00:00');
        dd.setMonth(dd.getMonth()+p);
        if(dd>=s&&dd<=e){
          const vIdx=r.pays+p;
          let mv=parseFloat(r.versement)||0;
          if(r.versement_type==='perso'&&r.versements_perso&&r.versements_perso[vIdx]&&parseFloat(r.versements_perso[vIdx].montant))
            mv=parseFloat(r.versements_perso[vIdx].montant);
          let mc=0;
          if(r.partage){
            if(r.partage_type==='perso'&&r.versements_perso&&r.versements_perso[vIdx]&&parseFloat(r.versements_perso[vIdx].copine_montant))
              mc=parseFloat(r.versements_perso[vIdx].copine_montant);
            else mc=mv/2;
          }
          if(r.acheteur==='Moi'||r.partage) mi.push({n:r.marchand,m:r.partage?mv-mc:mv,p:r.partage});
          if(r.acheteur==='Copine'||r.partage) co.push({n:r.marchand,m:r.partage?mc:mv,p:r.partage});
          break; // un seul versement par achat par mois
        }
      }
    } else {
      // Pour le mois courant/passé : calculer l'index théorique de l'échéance du mois cible
      const dueDate=new Date(r.due+'T12:00:00');
      const monthsFromDue=(y-dueDate.getFullYear())*12+(m-dueDate.getMonth());
      const instIdx=r.pays+monthsFromDue;
      if(instIdx>=0&&instIdx<r.total_inst){
        const mv=gv(r,instIdx);const mc=gc(r,instIdx);
        if(r.acheteur==='Moi'||r.partage)mi.push({n:r.marchand,m:r.partage?mv-mc:mv,p:r.partage});
        if(r.acheteur==='Copine'||r.partage)co.push({n:r.marchand,m:r.partage?mc:mv,p:r.partage});
      }
    }
  });
  return{mi,co};
}

function filtered(){
  const t=new Date();t.setHours(0,0,0,0);
  return G.rows.filter(r=>{
    const c=calc(r);const due=new Date(r.due+'T12:00:00');
    if(G.tab==='archive') return false; // les archivés ont leur propre vue
    if(G.tab==='all'&&c.st==='soldé')return false;
    if(G.tab==='upcoming'&&(c.st==='soldé'||(due<t&&c.st!=='retard')))return false;
    if(G.tab==='past'&&c.st!=='soldé')return false;
    if(G.fa==='moi_all'&&!(r.acheteur==='Moi'||r.partage))return false;
    if(G.fa==='moi_solo'&&!(r.acheteur==='Moi'&&!r.partage))return false;
    if(G.fa==='cop_all'&&!(r.acheteur==='Copine'||r.partage))return false;
    if(G.fa==='cop_solo'&&!(r.acheteur==='Copine'&&!r.partage))return false;
    if(G.fa==='partage'&&!r.partage)return false;
    if(G.fcat==='__none__'&&r.categorie)return false;
    if(G.fcat!=='tous'&&G.fcat!=='__none__'&&r.categorie!==G.fcat)return false;
    if(G.fs!=='tous'&&r.source!==G.fs)return false;
    return true;
  }).sort((a,b)=>{
    const ca=calc(a),cb=calc(b);
    switch(G.tri){
      case 'date':    return new Date(a.due)-new Date(b.due);
      case 'montant': return cb.restant-ca.restant;
      case 'alpha':   return a.marchand.localeCompare(b.marchand,'fr');
      case 'statut': {
        const o={retard:0,urgent:1,ok:2,soldé:3};
        return (o[ca.st]??2)-(o[cb.st]??2);
      }
      case 'acheteur': {
        const o2={Moi:0,partage:1,Copine:2};
        const ka=a.partage?'partage':a.acheteur;
        const kb=b.partage?'partage':b.acheteur;
        return (o2[ka]??1)-(o2[kb]??1);
      }
      case 'recent':  return new Date(b.created_at||0)-new Date(a.created_at||0);
      default:        return new Date(a.due)-new Date(b.due);
    }
  });
}

function kpis(){
  let te=0,tr=0,tp=0,mr=0,cr=0;
  G.rows.forEach(r=>{const c=calc(r);te+=c.total;tr+=c.restant;if(r.partage)tp+=c.pc;if(r.acheteur==='Moi')mr+=r.partage?c.restant-c.pc:c.restant;if(r.acheteur==='Copine')cr+=c.restant;});
  // Ajouter abonnements mensuels dans les totaux
  (G.abos||[]).filter(a=>a.actif).forEach(a=>{
    const amt=parseFloat(a.montant)||0;
    const mc=a.partage?(a.partage_type==='perso'?parseFloat(a.montant_copine||0):amt/2):0;
    if(a.partage) tp+=mc;
    else if(a.acheteur==='Moi') mr+=amt;
    else cr+=amt;
  });
  return{te,tr,tp,mr,cr};
}

function SB2(s){const m={soldé:['b-don','Soldé'],retard:['b-lat','Retard'],urgent:['b-urg','Urgent'],ok:['b-ok','OK']};const[cl,t]=m[s];return`<span class="badge ${cl}">${t}</span>`;}
function AB(r){if(r.partage)return`<span class="badge b-par">${r.partage_type==='perso'?'Partagé perso':'Partagé 50/50'}</span>`;if(r.acheteur==='Copine')return`<span class="badge b-cop">Copine</span>`;return`<span class="badge b-moi">Moi</span>`;}
function JT(j){if(j<0)return`<span class="c-red" style="font-weight:700">${Math.abs(j)}j</span>`;if(j===0)return`<span style="color:#D85A30;font-weight:700">Auj.</span>`;if(j<=7)return`<span style="color:#D85A30;font-weight:600">${j}j</span>`;return`<span style="color:#718096">${j}j</span>`;}

function MB(off){
  const now=new Date();
  const y=now.getFullYear(),m2=now.getMonth()+off;
  const d=GMD(y,m2);
  const ab=aboForMonth(y,m2);
  // Fusionner abos dans les listes
  const allMi=[...d.mi,...ab.mi];
  const allCo=[...d.co,...ab.co];
  d.mi=allMi; d.co=allCo;
  const tm=d.mi.reduce((s,i)=>s+i.m,0);
  const tc=d.co.reduce((s,i)=>s+i.m,0);
  const tpMoi=d.mi.filter(i=>i.p).reduce((s,i)=>s+i.m,0);
  const tpCop=d.co.filter(i=>i.p).reduce((s,i)=>s+i.m,0);
  const tpartage=tpMoi+tpCop;
  const tglobal=d.mi.filter(i=>!i.p).reduce((s,i)=>s+i.m,0)+d.co.filter(i=>!i.p).reduce((s,i)=>s+i.m,0)+tpartage;
  const bc=off===0?'var(--border)':'#c7d2fe';
  const bg=off===0?'var(--card)':'var(--card-next)';
  const tc2=off===0?'var(--text)':'#4338ca';
  return'<div class="mbox" style="border-color:'+bc+';background:'+bg+'">'+
    '<div class="mbox-t" style="color:'+tc2+'">\u{1F4C5} '+mn(off)+'</div>'+
    '<div class="mcols">'+
    '<div><h3 class="c-blue">\u{1F464} Moi</h3>'+
    (d.mi.length===0?'<div style="font-size:12px;color:#a0aec0">Rien</div>':
      d.mi.map(i=>'<div class="mitem"><span style="color:var(--text2)">'+i.n+(i.p?' <small style="color:#27500A">(partage)</small>':'')+ '</span><span class="c-blue" style="font-weight:600">'+f(i.m)+'</span></div>').join(''))+
    (d.mi.length>0?'<div class="mtotal"><span>Total moi</span><span class="c-blue">'+f(tm)+'</span></div>':'')+
    '</div>'+
    '<div><h3 class="c-amber">\u{1F491} Copine</h3>'+
    (d.co.length===0?'<div style="font-size:12px;color:#a0aec0">Rien</div>':
      d.co.map(i=>'<div class="mitem"><span style="color:var(--text2)">'+i.n+(i.p?' <small style="color:#27500A">(partage)</small>':'')+ '</span><span class="c-amber" style="font-weight:600">'+f(i.m)+'</span></div>').join(''))+
    (d.co.length>0?'<div class="mtotal"><span>Total copine</span><span class="c-amber">'+f(tc)+'</span></div>':'')+
    '</div></div>'+
    (tglobal>0?
      '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">'+
      (tpartage>0?
        '<div style="background:var(--bg);border-radius:8px;padding:8px 10px;margin-bottom:6px">'+
        '<div style="font-size:11px;font-weight:600;color:#27500A;margin-bottom:5px;text-transform:uppercase;letter-spacing:.3px">\u{1F91D} Achats partag\u00e9s</div>'+
        '<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span style="color:var(--text3)">Ma part</span><span style="font-weight:600;color:#185FA5">'+f(tpMoi)+'</span></div>'+
        '<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span style="color:var(--text3)">Part copine</span><span style="font-weight:600;color:#854F0B">'+f(tpCop)+'</span></div>'+
        '<div style="display:flex;justify-content:space-between;font-size:12px;padding-top:4px;margin-top:2px;border-top:1px solid var(--border)"><span style="color:var(--text3)">Total partag\u00e9</span><span style="font-weight:700;color:#27500A">'+f(tpartage)+'</span></div>'+
        '</div>'
      :'')+
      '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700"><span style="color:var(--text)">\u{1F4B0} Total global</span><span style="color:var(--text)">'+f(tglobal)+'</span></div>'+
      '</div>'
    :'')+
    '</div>';
}


// ── ABONNEMENTS ────────────────────────────────────────────────
function aboSection(){
  const abos = G.abos;
  const actifs = abos.filter(a=>a.actif);
  const totalMoi = actifs.filter(a=>!a.partage&&a.acheteur==='Moi').reduce((s,a)=>s+parseFloat(a.montant),0);
  const totalCop = actifs.filter(a=>!a.partage&&a.acheteur==='Copine').reduce((s,a)=>s+parseFloat(a.montant),0);
  const totalPar = actifs.filter(a=>a.partage).reduce((s,a)=>s+parseFloat(a.montant),0);
  const maPart   = actifs.filter(a=>a.partage).reduce((s,a)=>s+(a.partage_type==='perso'?parseFloat(a.montant_copine||0):(parseFloat(a.montant)/2)),0);

  return `<div class="mbox" style="margin-bottom:1rem">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:8px">
      <div class="mbox-t" style="margin:0">🔄 Abonnements & Prélèvements</div>
      <button class="btn btn-p" style="font-size:11px;padding:5px 10px" onclick="G.eabo='new';render()">+ Ajouter</button>
    </div>
    ${actifs.length===0?'<div style="font-size:12px;color:var(--text3)">Aucun abonnement actif</div>':''}
    ${actifs.map(a=>{
      const m=parseFloat(a.montant);
      const mc=a.partage?(a.partage_type==='perso'?parseFloat(a.montant_copine||0):m/2):0;
      const maPart2=a.partage?m-mc:m;
      return `<div class="mitem" style="padding:6px 0;align-items:center">
        <div>
          <span style="font-weight:500;color:var(--text)">${a.nom}</span>
          ${a.partage?`<span class="badge b-par" style="margin-left:5px">${a.partage_type==='perso'?'Partagé perso':'50/50'}</span>`:(a.acheteur==='Copine'?'<span class="badge b-cop" style="margin-left:5px">Copine</span>':'<span class="badge b-moi" style="margin-left:5px">Moi</span>')}
          <span style="font-size:11px;color:var(--text3);margin-left:4px">· J${a.jour_prelevement} chaque mois</span>
          ${a.notes?`<div style="font-size:11px;color:var(--text3)">${a.notes}</div>`:''}
        </div>
        <div style="text-align:right;display:flex;align-items:center;gap:8px">
          <div>
            <div style="font-weight:700;color:#185FA5">${f(m)}</div>
            ${a.partage?`<div style="font-size:10px;color:var(--text3)">ma part: ${f(maPart2)}</div>`:''}
          </div>
          <button class="btn btn-sm" onclick="G.eabo='${a.id}';render()" style="padding:3px 7px">✏️</button>
          <button class="btn btn-sm" onclick="toggleAbo('${a.id}',${a.actif})" style="padding:3px 7px;color:#276749">✓</button>
          <button class="btn btn-sm btn-d" onclick="delAbo('${a.id}')" style="padding:3px 7px">✕</button>
        </div>
      </div>`;
    }).join('')}
    ${actifs.length>0?`
    <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
      ${totalMoi>0?`<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span style="color:var(--text3)">👤 Moi (solo)</span><span style="font-weight:600;color:#185FA5">${f(totalMoi)}/mois</span></div>`:''}
      ${totalCop>0?`<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span style="color:var(--text3)">💑 Copine (solo)</span><span style="font-weight:600;color:#854F0B">${f(totalCop)}/mois</span></div>`:''}
      ${totalPar>0?`<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span style="color:var(--text3)">🤝 Partagés</span><span style="font-weight:600;color:#27500A">${f(totalPar)}/mois (ma part: ${f(maPart)})</span></div>`:''}
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;padding-top:6px;margin-top:4px;border-top:1px solid var(--border)">
        <span>💰 Total /mois</span><span>${f(totalMoi+totalCop+totalPar)}</span>
      </div>
    </div>`:''}
    ${abos.filter(a=>!a.actif).length>0?`<div style="font-size:11px;color:var(--text3);margin-top:8px">${abos.filter(a=>!a.actif).length} abonnement(s) inactif(s)</div>`:''}
  </div>
  ${G.eabo!==null?aboModal():''}`;
}

function aboModal(){
  const isNew=G.eabo==='new';
  const a=isNew?{nom:'',montant:'',jour_prelevement:1,acheteur:'Moi',partage:false,partage_type:'50/50',montant_copine:'',source:'Prélèvement',notes:'',actif:true}:G.abos.find(x=>x.id===G.eabo);
  if(!a)return'';
  return `<div class="overlay" onclick="if(event.target===this){G.eabo=null;render()}"><div class="modal">
    <h2>${isNew?'Ajouter un abonnement':'Modifier l\'abonnement'}</h2>
    <div class="fg">
      <div class="fr full"><label>Nom *</label><input id="an" value="${a.nom||''}" placeholder="Ex: Basic Fit, Netflix..."></div>
      <div class="fr"><label>Montant (€) *</label><input id="am" type="number" step="0.01" value="${a.montant||''}" oninput="aboUpdPart()"></div>
      <div class="fr"><label>Jour du mois</label><input id="aj" type="number" min="1" max="31" value="${a.jour_prelevement||1}"></div>
      <div class="fr"><label>Source</label>
        <select id="asr">${['PayPal','Oney','Cofidis','Carte bancaire','Virement','Prélèvement','Autre'].map(s=>`<option value="${s}" ${(a.source||'Prélèvement')===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="fr"><label>Qui paie ?</label>
        <select id="aac"><option value="Moi" ${(a.acheteur||'Moi')==='Moi'?'selected':''}>Moi</option><option value="Copine" ${a.acheteur==='Copine'?'selected':''}>Copine</option></select>
      </div>
      <div class="fr full"><label>Partage copine</label>
        <select id="apa" onchange="aboUpdPart()">
          <option value="non" ${!a.partage?'selected':''}>Non partagé</option>
          <option value="50/50" ${a.partage&&a.partage_type==='50/50'?'selected':''}>50/50</option>
          <option value="perso" ${a.partage&&a.partage_type==='perso'?'selected':''}>Montant fixe copine</option>
        </select>
      </div>
      <div class="fr full" id="abo-cop-wrap" style="${a.partage&&a.partage_type==='perso'?'':'display:none'}">
        <label>Montant copine (€)</label>
        <input id="amc" type="number" step="0.01" value="${a.montant_copine||''}" placeholder="Ex: 15.00">
      </div>
      <div class="fr full" id="abo-part-info" style="background:var(--bg);border-radius:8px;padding:8px 10px;font-size:12px;display:${a.partage?'block':'none'}">
        <span style="color:var(--text3)">Ma part : </span><span id="abo-ma-part" style="font-weight:600;color:#185FA5">—</span>
        <span style="color:var(--text3);margin-left:10px">Part copine : </span><span id="abo-cop-part" style="font-weight:600;color:#854F0B">—</span>
      </div>
      <div class="fr full"><label>Notes</label><input id="ano" value="${a.notes||''}" placeholder="Ex: Salle de sport..."></div>
    </div>
    <div class="macts">
      <button class="btn" onclick="G.eabo=null;render()">Annuler</button>
      <button class="btn btn-p" onclick="saveAbo(${isNew?"'new'":`'${a.id}'`})">${isNew?'Ajouter':'Enregistrer'}</button>
    </div>
  </div></div>`;
}

function aboUpdPart(){
  const m=parseFloat(document.getElementById('am')?.value)||0;
  const pa=document.getElementById('apa')?.value||'non';
  const wrap=document.getElementById('abo-cop-wrap');
  const info=document.getElementById('abo-part-info');
  if(wrap) wrap.style.display=(pa==='perso'?'':'none');
  if(info) info.style.display=(pa!=='non'?'block':'none');
  if(pa!=='non'&&m){
    const mc=pa==='perso'?(parseFloat(document.getElementById('amc')?.value)||0):m/2;
    const mm=m-mc;
    const el1=document.getElementById('abo-ma-part');
    const el2=document.getElementById('abo-cop-part');
    if(el1)el1.textContent=f(mm);
    if(el2)el2.textContent=f(mc);
  }
}

async function saveAbo(id){
  const nom=document.getElementById('an').value.trim();
  const montant=parseFloat(document.getElementById('am').value)||0;
  const jour=parseInt(document.getElementById('aj').value)||1;
  const acheteur=document.getElementById('aac').value;
  const pav=document.getElementById('apa').value;
  const partage=pav!=='non';
  const partage_type=pav==='non'?'50/50':pav;
  const montant_copine=partage&&partage_type==='perso'?(parseFloat(document.getElementById('amc').value)||0):0;
  const source=document.getElementById('asr').value;
  const notes=document.getElementById('ano').value.trim();
  if(!nom||!montant){alert('Nom et montant obligatoires');return;}
  const item={nom,montant,jour_prelevement:jour,acheteur,partage,partage_type,montant_copine,source,notes,actif:true};
  if(id==='new') await SB.from('abonnements').insert(item);
  else await SB.from('abonnements').update(item).eq('id',id);
  await LD(); G.eabo=null; render(); T(id==='new'?'Abonnement ajouté ✓':'Modifié ✓');
}

async function toggleAbo(id,actif){
  await SB.from('abonnements').update({actif:!actif}).eq('id',id);
  await LD(); render(); T(!actif?'Activé ✓':'Mis en pause');
}

async function delAbo(id){
  if(!confirm('Supprimer cet abonnement ?'))return;
  await SB.from('abonnements').delete().eq('id',id);
  await LD(); render(); T('Supprimé');
}


// ── CALENDRIER ─────────────────────────────────────────────────
function calSection(){
  const {y,m,sel} = G.cal;
  const today = new Date(); today.setHours(0,0,0,0);
  const firstDay = new Date(y,m,1).getDay(); // 0=dim
  const startDow = (firstDay+6)%7; // lundi=0
  const daysInMonth = new Date(y,m+1,0).getDate();
  const daysInPrev = new Date(y,m,0).getDate();

  // Construire map des échéances par jour
  const eMap = {};
  G.rows.forEach(r=>{
    const c2=calc(r);
    if(c2.st==='soldé') return;
    const d=new Date(r.due+'T12:00:00');
    if(d.getFullYear()===y&&d.getMonth()===m){
      const k=d.getDate();
      if(!eMap[k]) eMap[k]=[];
      eMap[k].push(r);
    }
  });
  // Abonnements : le jour du mois
  (G.abos||[]).filter(a=>a.actif).forEach(a=>{
    const k=a.jour_prelevement;
    if(k>=1&&k<=daysInMonth){
      if(!eMap[k]) eMap[k]=[];
      eMap[k].push({...a, _abo:true});
    }
  });

  const monthName = new Date(y,m,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

  // Générer les cellules
  let cells='';
  const totalCells = Math.ceil((startDow+daysInMonth)/7)*7;
  for(let i=0;i<totalCells;i++){
    const dayNum = i-startDow+1;
    const isCurrentMonth = dayNum>=1&&dayNum<=daysInMonth;
    const displayNum = isCurrentMonth ? dayNum : (dayNum<1 ? daysInPrev+dayNum : dayNum-daysInMonth);
    const isToday = isCurrentMonth && new Date(y,m,dayNum).getTime()===today.getTime();
    const isSel = isCurrentMonth && sel===dayNum;
    const items = isCurrentMonth ? (eMap[dayNum]||[]) : [];

    // Points colorés
    let hasMoi=false,hasCop=false,hasPar=false;
    items.forEach(r=>{
      if(r._abo){
        if(r.partage) hasPar=true;
        else if(r.acheteur==='Copine') hasCop=true;
        else hasMoi=true;
      } else {
        if(r.partage) hasPar=true;
        else if(r.acheteur==='Copine') hasCop=true;
        else hasMoi=true;
      }
    });

    const dots = items.length>0 ? `<div class="cal-dots">
      ${hasMoi?'<div class="cal-dot" style="background:#185FA5"></div>':''}
      ${hasCop?'<div class="cal-dot" style="background:#854F0B"></div>':''}
      ${hasPar?'<div class="cal-dot" style="background:#27500A"></div>':''}
    </div>` : '';

    cells += `<div class="cal-day${!isCurrentMonth?' other-month':''}${isToday?' today':''}${isSel?' selected':''}" 
      onclick="${isCurrentMonth?`G.cal.sel=${isSel?'null':dayNum};render()`:''}" >
      <div class="cal-num">${displayNum}</div>
      ${dots}
    </div>`;
  }

  // Détail du jour sélectionné
  let detail='';
  if(sel && eMap[sel]){
    const items2=eMap[sel];
    const moi=items2.filter(r=>!r.partage&&(r.acheteur==='Moi'||r._abo&&r.acheteur==='Moi'));
    const cop=items2.filter(r=>!r.partage&&(r.acheteur==='Copine'||r._abo&&r.acheteur==='Copine'));
    const par=items2.filter(r=>r.partage);
    const selDate=new Date(y,m,sel).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});

    detail=`<div class="cal-detail">
      <div class="cal-detail-title">📅 ${selDate}</div>
      ${moi.length?`<div style="font-weight:600;color:#185FA5;font-size:11px;text-transform:uppercase;margin:4px 0 2px">👤 Moi</div>
        ${moi.map(r=>{const amt=r._abo?parseFloat(r.montant):calc(r).cv;return`<div class="cal-detail-row"><span>${r.nom||r.marchand}${r._abo?' 🔄':''}</span><span style="font-weight:600;color:#185FA5">${f(amt)}</span></div>`;}).join('')}`:''}
      ${cop.length?`<div style="font-weight:600;color:#854F0B;font-size:11px;text-transform:uppercase;margin:4px 0 2px">💑 Copine</div>
        ${cop.map(r=>{const amt=r._abo?parseFloat(r.montant):calc(r).cv;return`<div class="cal-detail-row"><span>${r.nom||r.marchand}${r._abo?' 🔄':''}</span><span style="font-weight:600;color:#854F0B">${f(amt)}</span></div>`;}).join('')}`:''}
      ${par.length?`<div style="font-weight:600;color:#27500A;font-size:11px;text-transform:uppercase;margin:4px 0 2px">🤝 Partagé</div>
        ${par.map(r=>{const c2=calc(r);return`<div class="cal-detail-row"><span>${r.marchand}</span><span style="font-weight:600;color:#27500A">${f(c2.cv)}</span></div>`;}).join('')}`:''}
    </div>`;
  }

  return `<div class="cal-box">
    <div class="cal-header">
      <button class="cal-nav" onclick="G.cal.m--;if(G.cal.m<0){G.cal.m=11;G.cal.y--;}G.cal.sel=null;render()">‹</button>
      <div class="cal-title">${monthName}</div>
      <button class="cal-nav" onclick="G.cal.m++;if(G.cal.m>11){G.cal.m=0;G.cal.y++;}G.cal.sel=null;render()">›</button>
    </div>
    <div class="cal-grid">
      <div class="cal-day-name">Lu</div><div class="cal-day-name">Ma</div><div class="cal-day-name">Me</div>
      <div class="cal-day-name">Je</div><div class="cal-day-name">Ve</div><div class="cal-day-name">Sa</div>
      <div class="cal-day-name">Di</div>
      ${cells}
    </div>
    ${detail}
  </div>`;
}

// ── ALERTES URGENTES ────────────────────────────────────────────
function alertSection(){
  const urgent = G.rows.filter(r=>{
    const c2=calc(r);
    return c2.st==='urgent'; // moins de 7 jours
  }).sort((a,b)=>new Date(a.due)-new Date(b.due));
  if(!urgent.length) return '';
  return `<div style="margin-bottom:1rem">
    ${urgent.map(r=>{
      const c2=calc(r);
      const couleur=c2.j===0?'#A32D2D':c2.j<=3?'#C0390B':'#BA7517';
      const bg=c2.j===0?'#FCEBEB':c2.j<=3?'#FAECE7':'#FAEEDA';
      return`<div style="background:${bg};border-left:3px solid ${couleur};border-radius:8px;padding:8px 12px;margin-bottom:5px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:7px;height:7px;border-radius:50%;background:${couleur};flex-shrink:0"></div>
          <div>
            <span style="font-weight:600;font-size:12px;color:${couleur}">${r.marchand}</span>
            <span style="font-size:11px;color:${couleur};margin-left:6px">${c2.j===0?'Aujourd\'hui':c2.j+'j restants'}</span>
          </div>
        </div>
        <span style="font-weight:700;font-size:12px;color:${couleur}">${f(c2.cv)}</span>
      </div>`;
    }).join('')}
  </div>`;
}





function render(){
  // Defensive cleanup: remove any stale body lock styles from old mobile fixes.
  document.body.classList.remove('modal-open');
  document.body.style.top='';
  document.body.style.position='';
  document.body.style.width='';
  document.body.style.height='';
  document.body.style.overflow='';
  applyDark();
  const k=kpis();
  const al=G.rows.filter(r=>{const c=calc(r);return c.st==='urgent'||c.st==='retard';}).sort((a,b)=>new Date(a.due)-new Date(b.due));
  const rows=filtered();
  let sm={e:0,d:0,r:0},sc={e:0,d:0,r:0},sp={e:0,d:0,r:0,a:0};
  G.rows.forEach(r=>{const c=calc(r);if(r.partage){sp.e+=c.total;sp.d+=c.deja;sp.r+=c.restant;sp.a+=c.pc;}else if(r.acheteur==='Moi'){sm.e+=c.total;sm.d+=c.deja;sm.r+=c.restant;}else{sc.e+=c.total;sc.d+=c.deja;sc.r+=c.restant;}});
  const nEn=G.rows.filter(r=>calc(r).st!=='soldé').length;
  const nSo=G.rows.filter(r=>calc(r).st==='soldé').length;

  document.getElementById('app').innerHTML=`
<div class="topbar"><h1>MY <span>Wallet</span> 💛 <span style="font-size:11px;color:var(--text3)">(${G.user_role||'Moi'})</span></h1><div class="topbar-r">${G.user_role==='Moi'?'<button class="btn" onclick="openLogs()" title="Historique paiements" style="padding:6px 10px">📜</button>':''}<button class="btn" onclick="exportPDF()" title="Export PDF" style="padding:6px 10px">📄</button><button class="btn" onclick="G.sm=true;render()" style="font-size:16px;padding:6px 10px">⚙️</button><button class="btn btn-p" onclick="OE(null)">+ Ajouter</button></div></div>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-l">Total engagé</div><div class="kpi-v c-blue">${f(k.te)}</div></div>
  <div class="kpi"><div class="kpi-l">Reste à payer</div><div class="kpi-v c-red">${f(k.tr)}</div></div>
  <div class="kpi"><div class="kpi-l">Ma part</div><div class="kpi-v c-blue">${f(k.mr)}</div></div>
  <div class="kpi"><div class="kpi-l">Part copine</div><div class="kpi-v c-amber">${f(k.cr)}</div></div>
  <div class="kpi"><div class="kpi-l">À récupérer</div><div class="kpi-v c-purple">${f(k.tp)}</div></div>
</div>
<div class="chart-box">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:8px">
    <h3 style="margin:0">📊 ${G.comp?'Comparaison N-1':G.sf?'6 derniers mois':'6 prochains mois'}</h3>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button onclick="G.sf=!G.sf;G.comp=false;render()" style="padding:4px 10px;border-radius:20px;border:1px solid ${!G.comp&&G.sf?'#185FA5':'var(--border)'};background:${!G.comp&&G.sf?'#185FA5':'var(--card)'};color:${!G.comp&&G.sf?'#fff':'var(--text3)'};font-size:11px;cursor:pointer;font-family:inherit;touch-action:manipulation">
        ${G.sf?'📅 Prochains':'🕐 Historique'}
      </button>
      <button onclick="G.comp=!G.comp;render()" style="padding:4px 10px;border-radius:20px;border:1px solid ${G.comp?'#854F0B':'var(--border)'};background:${G.comp?'#854F0B':'var(--card)'};color:${G.comp?'#fff':'var(--text3)'};font-size:11px;cursor:pointer;font-family:inherit;touch-action:manipulation">
        📊 vs N-1
      </button>
    </div>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
    <button onclick="G.cfa='tous';render()"   style="padding:3px 10px;border-radius:20px;border:1px solid var(--border);background:${G.cfa==='tous'?'#185FA5':'var(--card)'};color:${G.cfa==='tous'?'#fff':'var(--text3)'};font-size:11px;cursor:pointer;font-family:inherit;touch-action:manipulation">Tous</button>
    <button onclick="G.cfa='moi_p';render()"  style="padding:3px 10px;border-radius:20px;border:1px solid var(--border);background:${G.cfa==='moi_p'?'#185FA5':'var(--card)'};color:${G.cfa==='moi_p'?'#fff':'var(--text3)'};font-size:11px;cursor:pointer;font-family:inherit;touch-action:manipulation">👤 Moi + partagés</button>
    <button onclick="G.cfa='moi_s';render()"  style="padding:3px 10px;border-radius:20px;border:1px solid var(--border);background:${G.cfa==='moi_s'?'#185FA5':'var(--card)'};color:${G.cfa==='moi_s'?'#fff':'var(--text3)'};font-size:11px;cursor:pointer;font-family:inherit;touch-action:manipulation">👤 Moi seul</button>
    <button onclick="G.cfa='cop_p';render()"  style="padding:3px 10px;border-radius:20px;border:1px solid var(--border);background:${G.cfa==='cop_p'?'#185FA5':'var(--card)'};color:${G.cfa==='cop_p'?'#fff':'var(--text3)'};font-size:11px;cursor:pointer;font-family:inherit;touch-action:manipulation">💑 Copine + partagés</button>
    <button onclick="G.cfa='cop_s';render()"  style="padding:3px 10px;border-radius:20px;border:1px solid var(--border);background:${G.cfa==='cop_s'?'#185FA5':'var(--card)'};color:${G.cfa==='cop_s'?'#fff':'var(--text3)'};font-size:11px;cursor:pointer;font-family:inherit;touch-action:manipulation">💑 Copine seule</button>
    <button onclick="G.cfa='par';render()"    style="padding:3px 10px;border-radius:20px;border:1px solid var(--border);background:${G.cfa==='par'?'#185FA5':'var(--card)'};color:${G.cfa==='par'?'#fff':'var(--text3)'};font-size:11px;cursor:pointer;font-family:inherit;touch-action:manipulation">🤝 Partagés</button>
  </div>
  <canvas id="chart-mois" height="200"></canvas>
  <div id="chart-detail" style="display:none;margin-top:10px;background:var(--bg);border-radius:8px;padding:10px;font-size:12px"></div>
</div>
<div class="chart-box">
  <h3 style="margin-bottom:1rem">🏷️ Dépenses par catégorie</h3>
  <div class="cat-layout">
    <div class="cat-canvas-wrap"><canvas id="chart-cat"></canvas></div>
    <div id="cat-legend" class="cat-legend"></div>
  </div>
</div>
${alertSection()}${salaireWidget()}${calSection()}${MB(0)}
${MB(1)}

${previsionAnnuelle()}<div class="sg">
  <div class="sc"><h3 class="c-blue">👤 Moi (solo)</h3><div class="sr"><span>Total</span><span>${f(sm.e)}</span></div><div class="sr"><span>Payé</span><span class="c-green">${f(sm.d)}</span></div><div class="sr"><span>Reste</span><span class="c-red">${f(sm.r)}</span></div></div>
  <div class="sc"><h3 class="c-amber">💑 Copine (solo)</h3><div class="sr"><span>Total</span><span>${f(sc.e)}</span></div><div class="sr"><span>Payé</span><span class="c-green">${f(sc.d)}</span></div><div class="sr"><span>Reste</span><span class="c-red">${f(sc.r)}</span></div></div>
  <div class="sc"><h3 style="color:#27500A">🤝 Partagés</h3><div class="sr"><span>Total</span><span>${f(sp.e)}</span></div><div class="sr"><span>Payé</span><span class="c-green">${f(sp.d)}</span></div><div class="sr"><span>Reste</span><span class="c-red">${f(sp.r)}</span></div><div class="sr" style="border-top:1px solid #f0f4f8;margin-top:4px;padding-top:4px"><span>À récupérer</span><span class="c-purple">${f(sp.a)}</span></div></div>
</div><br>${aboSection()}
<div class="tabs">
  <button class="tab ${G.tab==='all'?'on':''}" onclick="G.tab='all';render()">En cours (${nEn})</button>
  <button class="tab ${G.tab==='upcoming'?'on':''}" onclick="G.tab='upcoming';render()">À venir</button>
  <button class="tab ${G.tab==='past'?'on':''}" onclick="G.tab='past';render()">Soldés (${nSo})</button>
  <button class="tab ${G.tab==='archive'?'on':''}" onclick="G.tab='archive';render()" style="color:#718096">🗃️ Archives (${G.archive_rows.length})</button>
</div>
<div class="filters">
  <input id="search-input" placeholder="Rechercher..." value="${G.fq}" oninput="Q(this)" style="min-width:120px;flex:1;max-width:180px">
  <select onchange="G.fa=this.value;render()">
    <option value="tous" ${G.fa==='tous'?'selected':''}>Tous</option>
    <option value="moi_all" ${G.fa==='moi_all'?'selected':''}>Moi (partagés inclus)</option>
    <option value="moi_solo" ${G.fa==='moi_solo'?'selected':''}>Moi sans partagés</option>
    <option value="cop_all" ${G.fa==='cop_all'?'selected':''}>Copine (partagés inclus)</option>
    <option value="cop_solo" ${G.fa==='cop_solo'?'selected':''}>Copine sans partagés</option>
    <option value="partage" ${G.fa==='partage'?'selected':''}>Partagés</option>
  </select>
  <select onchange="G.fcat=this.value;render()">
    <option value="tous" ${G.fcat==='tous'?'selected':''}>Toutes catégories</option>
    <option value="__none__" ${G.fcat==='__none__'?'selected':''}>Sans catégorie</option>
    ${G.cats.map(c=>`<option value="${c.nom}" ${G.fcat===c.nom?'selected':''}>${c.icon||'🏷️'} ${c.nom}</option>`).join('')}
  </select>
  <select onchange="G.fs=this.value;render()">
    <option value="tous">Toutes sources</option>
    ${SRC.map(s=>`<option value="${s}" ${G.fs===s?'selected':''}>${s}</option>`).join('')}
  </select>
  <select onchange="G.tri=this.value;render()" style="min-width:170px">
    <option value="date"    ${G.tri==='date'   ?'selected':''}>📅 Échéance (+ proche)</option>
    <option value="montant" ${G.tri==='montant'?'selected':''}>💰 Montant restant (+ grand)</option>
    <option value="statut"  ${G.tri==='statut' ?'selected':''}>⚠️ Statut (retard → ok)</option>
    <option value="alpha"   ${G.tri==='alpha'  ?'selected':''}>🔤 Marchand (A → Z)</option>
    <option value="acheteur"${G.tri==='acheteur'?'selected':''}>👤 Acheteur (Moi → Copine)</option>
    <option value="recent"  ${G.tri==='recent' ?'selected':''}>🕐 Ajout récent</option>
  </select>
  <button class="btn" onclick="RF()" title="Réinitialiser les filtres">♻️ Reset</button>
</div>
<div class="cards">
${rows.length===0?'<div class="empty">Aucun résultat</div>':rows.map(r=>{
  const c=calc(r);const pct=Math.round((r.pays/r.total_inst)*100);
  const bc=c.st==='soldé'?'#276749':c.st==='retard'?'#A32D2D':'#185FA5';
  const catIcon = r.categorie ? G.cats.find(c=>c.nom===r.categorie)?.icon || '' : '';
  return`<div class="card" data-search="${(r.marchand+' '+(r.notes||'')).toLowerCase()}" onclick="OE('${r.id}')">
    <div class="ch"><div><div class="ctitle">${catIcon ? catIcon + ' ' : ''}${r.marchand}</div>${r.notes?`<div class="cnote">${r.notes}</div>`:''}</div>
      <div style="text-align:right"><div style="font-size:15px;font-weight:700" class="c-blue">${f(c.cv)}</div><div style="font-size:10px;color:#a0aec0">/versement</div></div>
    </div>
    <div class="cbadges">${AB(r)}${SB2(c.st)}<span class="badge b-src">${r.source||'—'}</span></div>
    <div class="cgrid">
      <div><div class="cl">Total achat</div><div class="cv">${f(c.total)}</div></div>
      <div><div class="cl">Déjà payé</div><div class="cv c-green">${f(c.deja)}</div></div>
      <div><div class="cl">Restant</div><div class="cv c-red">${f(c.restant)}</div></div>
      <div><div class="cl">Prochaine éch.</div><div class="cv">${c.rest===0?'—':fd(r.due)}</div></div>
      <div><div class="cl">Jours</div><div class="cv">${JT(c.j)}</div></div>
    </div>
    <div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#a0aec0;margin-bottom:2px"><span>${r.pays}/${r.total_inst}</span><span>${pct}%</span></div>
      <div class="pbar"><div class="pfill" style="width:${pct}%;background:${bc}"></div></div>
    </div>
    <div class="ca" onclick="event.stopPropagation()">
      <button class="btn-pay" ${c.pd?'disabled':''} onclick="OP('${r.id}')">${c.pd&&c.st!=='soldé'?'✓ Payé':'💳 Payer'}</button>
      ${r.partage?`<button class="remb ${c.pdCop?'remb-o':'remb-n'}" onclick="TR('${r.id}',${c.pdCop})">${c.pdCop?'✓ Remb.':'⏳ Non remb.'}</button>`:''}
      <button class="btn btn-sm btn-d" onclick="DR('${r.id}')">Suppr.</button>
    </div>
  </div>`;
}).join('')}
</div>
<div id="cards-live-empty" class="empty" style="display:none">Aucun résultat</div>
<div class="twrap">
${rows.length===0?'<div class="empty">Aucun résultat</div>':`<table><thead><tr><th>Marchand</th><th>Source</th><th>Acheteur</th><th>Versement</th><th>Payé</th><th>Total</th><th>Progrès</th><th>Restant</th><th>Prochaine éch.</th><th>Jours</th><th>Statut</th><th>Copine</th><th>Actions</th></tr></thead><tbody>
${rows.map(r=>{const c=calc(r);const pct=Math.round((r.pays/r.total_inst)*100);const bc=c.st==='soldé'?'#276749':c.st==='retard'?'#A32D2D':'#185FA5';const catIcon = r.categorie ? G.cats.find(cat=>cat.nom===r.categorie)?.icon || '' : '';return`<tr data-search="${(r.marchand+' '+(r.notes||'')).toLowerCase()}" onclick="OE('${r.id}')">
  <td><div style="font-weight:500">${catIcon ? catIcon + ' ' : ''}${r.marchand}</div>${r.notes?`<div style="font-size:10px;color:#a0aec0">${r.notes}</div>`:''}</td>
  <td><span class="badge b-src">${r.source||'—'}</span></td><td>${AB(r)}</td>
  <td style="font-weight:600;white-space:nowrap">${f(c.cv)}</td><td style="font-weight:600;color:#276749;white-space:nowrap">${f(c.deja)}</td><td style="white-space:nowrap">${f(c.total)}</td>
  <td><div style="font-size:10px;color:#a0aec0">${r.pays}/${r.total_inst}</div><div class="pbar" style="width:72px"><div class="pfill" style="width:${pct}%;background:${bc}"></div></div></td>
  <td style="font-weight:600;white-space:nowrap" class="${c.restant>0?'c-red':'c-green'}">${f(c.restant)}</td>
  <td style="white-space:nowrap">${c.rest===0?'—':fdf(r.due)}</td><td>${JT(c.j)}</td><td>${SB2(c.st)}</td>
  <td>${r.partage?`<button class="remb ${c.pdCop?'remb-o':'remb-n'}" onclick="event.stopPropagation();TR('${r.id}',${c.pdCop})">${c.pdCop?'✓':'⏳'}</button>`:'—'}</td>
  <td onclick="event.stopPropagation()"><div style="display:flex;gap:4px"><button class="btn-pay" ${c.pd?'disabled':''} onclick="OP('${r.id}')">${c.pd&&c.st!=='soldé'?'✓':'💳'}</button><button class="btn btn-sm btn-d" onclick="DR('${r.id}')">✕</button></div></td>
</tr>`;}).join('')}
</tbody></table>`}
<div id="table-live-empty" class="empty" style="display:none;padding:1rem">Aucun résultat</div>
</div>
${G.tab==='archive'?renderArchives():''}
${G.eid!==null?EM():''}${G.pid?PM():''}${G.sm?SM():''}${G.lm?LM():''}`;
  applyLiveSearch();
  setTimeout(drawChart, 50);
  setTimeout(drawCategoryChart, 50);
}

function EM(){
  const isN=G.eid==='new';
  const r=isN?{marchand:'',versement:'',montant_total:'',pays:0,total_inst:4,due:'',acheteur:'Moi',partage:false,partage_type:'50/50',versement_type:'egal',versements_perso:null,source:'Carte bancaire',notes:''}:G.rows.find(x=>x.id===G.eid);
  if(!r)return'';
  const vt=r.versement_type||'egal';const pt=r.partage_type||'50/50';const nb=parseInt(r.total_inst)||4;
  const sc2=r.partage&&pt==='perso';
  const vph=vt==='perso'?`<div style="background:#f7fafc;border-radius:10px;padding:.75rem;margin-top:4px">
    <div style="font-size:11px;font-weight:600;color:#718096;text-transform:uppercase;margin-bottom:6px">Saisir chaque versement${sc2?' et la part copine':''}</div>
    <table class="vpt"><thead><tr><th>#</th><th>Montant (€)</th>${sc2?'<th>Part copine (€)</th>':''}</tr></thead><tbody>
    ${Array.from({length:nb},(_,i)=>{const vp=(r.versements_perso&&r.versements_perso[i])||{};return`<tr><td style="color:#718096;font-weight:600">${i+1}</td><td><input type="number" step="0.01" id="vpm_${i}" value="${vp.montant||''}" placeholder="0.00" oninput="CVT()"></td>${sc2?`<td><input type="number" step="0.01" id="vpc_${i}" value="${vp.copine_montant||''}" placeholder="0.00"></td>`:''}</tr>`;}).join('')}
    </tbody></table>
    <div style="margin-top:8px;font-size:12px;color:#718096">Total : <span id="vpt-t" style="font-weight:600;color:#185FA5">0,00 €</span></div>
  </div>`:'';
  return`<div class="overlay" onclick="if(event.target===this){G.eid=null;render()}"><div class="modal">
    <h2>${isN?'Ajouter un achat':'Modifier l\'achat'}</h2>
    <div class="fg">
      <div class="fr full"><label>Marchand *</label><input id="em" value="${r.marchand||''}" placeholder="Ex: Amazon..."></div>
      <div class="fr full"><label>Type de versements</label><select id="evt" onchange="RVP()"><option value="egal" ${vt==='egal'?'selected':''}>Versements égaux</option><option value="perso" ${vt==='perso'?'selected':''}>Versements personnalisés</option></select></div>
      <div class="fr" id="ev-r" ${vt==='perso'?'style="display:none"':''}><label>Versement (€) *</label><input id="ev" type="number" step="0.01" value="${r.versement||''}" oninput="AT()"></div>
      <div class="fr"><label>Nb versements</label><input id="et" type="number" min="1" value="${r.total_inst||4}" oninput="AT();RVP()"></div>
      <div class="fr" id="ett-r" ${vt==='perso'?'style="display:none"':''}><label>Montant total (€)</label><input id="ett" type="number" step="0.01" value="${r.montant_total||''}" placeholder="Auto" oninput="this.dataset.m=1"></div>
      <div class="fr"><label>Versements payés</label><input id="ep" type="number" min="0" value="${r.pays||0}"></div>
      <div class="fr"><label>Prochaine échéance *</label><input id="ed" type="date" value="${r.due||''}"></div>
      <div class="fr"><label>Source</label><select id="esr">${SRC.map(s=>`<option value="${s}" ${(r.source||'Carte bancaire')===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="fr"><label>Acheteur (CB)</label><select id="ea"><option value="Moi" ${(r.acheteur||'Moi')==='Moi'?'selected':''}>Moi</option><option value="Copine" ${r.acheteur==='Copine'?'selected':''}>Copine</option></select></div>
      <div class="fr full"><label>Partage copine</label><select id="epa" onchange="RVP()"><option value="non" ${!r.partage?'selected':''}>Non partagé</option><option value="50/50" ${r.partage&&pt==='50/50'?'selected':''}>Partagé 50/50</option><option value="perso" ${r.partage&&pt==='perso'?'selected':''}>Partagé personnalisé</option></select></div>
      <div class="fr full" id="vp-w">${vph}</div>
      <div class="fr full"><label>Catégorie</label>
        <select id="ecat">
          <option value="">— Sans catégorie —</option>
          ${G.cats.map(cat=>`<option value="${cat.nom}" ${(r.categorie&&r.categorie===cat.nom)?'selected':''}>${cat.icon} ${cat.nom}</option>`).join('')}
        </select>
      </div>
      <div class="fr full"><label>Notes</label><input id="en" value="${r.notes||''}" placeholder="Ex: Vacances..."></div>
    </div>
    <div class="macts"><button class="btn" onclick="G.eid=null;render()">Annuler</button><button class="btn btn-p" onclick="SR(${isN?"'new'":`'${r.id}'`})">${isN?'Ajouter':'Enregistrer'}</button></div>
  </div></div>`;
}

function AT(){const v=parseFloat(document.getElementById('ev')?.value)||0;const t=parseInt(document.getElementById('et')?.value)||0;const el=document.getElementById('ett');if(el&&v&&t&&!el.dataset.m)el.value=(v*t).toFixed(2);}
function CVT(){const nb=parseInt(document.getElementById('et')?.value)||4;let tot=0;for(let i=0;i<nb;i++){const el=document.getElementById(`vpm_${i}`);if(el)tot+=parseFloat(el.value)||0;}const el=document.getElementById('vpt-t');if(el)el.textContent=f(tot);}
function RVP(){
  const vt=document.getElementById('evt')?.value;
  const nb=parseInt(document.getElementById('et')?.value)||4;
  const pa=document.getElementById('epa')?.value||'non';
  const ip=vt==='perso';
  const sc2=pa==='perso'; // colonne copine si partage perso, peu importe le type de versement

  const evR=document.getElementById('ev-r');const ettR=document.getElementById('ett-r');
  if(evR)evR.style.display=ip?'none':'';
  if(ettR)ettR.style.display=ip?'none':'';

  const w=document.getElementById('vp-w');if(!w)return;

  // Afficher le tableau si versements perso OU si partage perso (pour saisir les parts copine)
  if(!ip&&!sc2){w.innerHTML='';return;}

  const showMontant=ip; // colonnes montant seulement si versements perso
  w.innerHTML=`<div style="background:#f7fafc;border-radius:10px;padding:.75rem">
    <div style="font-size:11px;font-weight:600;color:#718096;text-transform:uppercase;margin-bottom:6px">
      ${ip&&sc2?'Saisir chaque versement et la part de ta copine':ip?'Saisir chaque versement':'Saisir la part de ta copine par versement'}
    </div>
    <table class="vpt"><thead><tr><th>#</th>${showMontant?'<th>Montant (€)</th>':''}${sc2?'<th>Part copine (€)</th>':''}</tr></thead><tbody>
    ${Array.from({length:nb},(_,i)=>`<tr>
      <td style="color:#718096;font-weight:600">${i+1}</td>
      ${showMontant?`<td><input type="number" step="0.01" id="vpm_${i}" placeholder="0.00" oninput="CVT()"></td>`:''}
      ${sc2?`<td><input type="number" step="0.01" id="vpc_${i}" placeholder="0.00"></td>`:''}
    </tr>`).join('')}
    </tbody></table>
    ${ip?`<div style="margin-top:8px;font-size:12px;color:#718096">Total : <span id="vpt-t" style="font-weight:600;color:#185FA5">0,00 €</span></div>`:''}
  </div>`;
}

function PM(){
  const r=G.rows.find(x=>x.id===G.pid);if(!r)return'';
  const c=calc(r);
  const rest=Math.max(0,r.total_inst-r.pays);
  return`<div class="overlay" onclick="if(event.target===this){G.pid=null;render()}"><div class="modal">
    <h2>💳 Payer — ${r.marchand}</h2>

    ${r.partage?`<div class="psec"><h3>👤 Qui paie ?</h3>
      <div class="popt"><input type="radio" name="qui" id="qui1" value="moi" ${!c.pd?'checked':''} onchange="UPS()" ${c.pd?'disabled':''}><label for="qui1" style="${c.pd?'opacity:.4':''}">Moi — payer une ou plusieurs échéances${c.pd?'<br><small style="color:#a0aec0">Déjà payé ce mois</small>':''}</label></div>
      <div class="popt"><input type="radio" name="qui" id="qui2" value="cop" onchange="UPS()" ${c.st==='soldé'?'disabled':''}><label for="qui2" style="${c.st==='soldé'?'opacity:.4':''}">💑 Copine — ${c.pc>0?`rembourser <b>${f(c.cc)}</b> ou le total <b>${f(c.pc)}</b>`:'pré-payer ses prochaines parts'}</label></div>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        <span style="font-size:12px;color:#718096">Échéances à payer (Moi) :</span>
        <select id="qnb" onchange="UPS()" ${c.pd?'disabled':''} style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:12px">
          ${Array.from({length:rest},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}
        </select>
      </div>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
        <label style="font-size:12px;color:#718096"><input type="radio" name="cpay" value="one" checked onchange="UPS()"> Copine paie une part (${f(c.cc)})</label>
        <label style="font-size:12px;color:#718096"><input type="radio" name="cpay" value="all" onchange="UPS()"> Copine paie tout le restant (${f(sumCopShares(r,r.pays,rest))})</label>
      </div>
    </div>`:`<div class="psec"><h3>Que voulez-vous payer ?</h3>
      <div class="popt"><input type="radio" name="pt" id="pt1" value="ech" checked onchange="UPS()"><label for="pt1">Payer des échéances <b>${f(c.cv)}</b><br><small style="color:#718096">${rest>1?`Tu peux en payer plusieurs d'un coup`:'Dernière échéance, pas de prochaine date'}</small></label></div>
      <div class="popt"><input type="radio" name="pt" id="pt2" value="tot" onchange="UPS()"><label for="pt2">Solder le reste complet <b>${f(c.restant)}</b></label></div>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        <span style="font-size:12px;color:#718096">Nombre d'échéances :</span>
        <select id="nnb" onchange="UPS()" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:12px">
          ${Array.from({length:rest},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}
        </select>
      </div>
    </div>`}

    ${!r.partage?`<div class="psum" id="ps"></div>`:`<div class="psum" id="ps"></div>`}
    <div class="macts"><button class="btn" onclick="G.pid=null;render()">Annuler</button><button class="btn btn-p" onclick="CP('${r.id}')">✓ Confirmer</button></div>
  </div></div>`;
}

function UPS(){
  const r=G.rows.find(x=>x.id===G.pid);if(!r)return;
  const c=calc(r);
  let h='';
  if(r.partage){
    const bal=getCopCredit(r.id);
    const rest=Math.max(0,r.total_inst-r.pays);
    const totalFuture=sumCopShares(r,r.pays,rest);
    const qui=document.querySelector('input[name="qui"]:checked')?.value||'moi';
    if(qui==='cop'){
      const mode=document.querySelector('input[name="cpay"]:checked')?.value||'one';
      const one=(bal>0?Math.min(c.cc,bal):c.cc);
      const all=(bal>0?bal:Math.max(0,totalFuture+bal));
      const amt=Math.max(0,mode==='all'?all:one);
      const nextBal=bal-amt;
      h+=`<div class="psr"><span>Paiement copine</span><span>${f(amt)}</span></div>`;
      h+=`<div class="psr"><span>À récupérer après</span><span>${f(Math.max(0,nextBal))}</span></div>`;
      h+=`<div class="psr tot"><span>Copine débourse</span><span class="c-amber">${f(amt)}</span></div>`;
    } else {
      const nb=parseInt(document.getElementById('qnb')?.value)||1;
      const total=sumInstAmounts(r,r.pays,nb);
      const cop=sumCopShares(r,r.pays,nb);
      h+=`<div class="psr"><span>Versements payés (${nb})</span><span>${f(total)}</span></div>`;
      h+=`<div class="psr"><span>Part copine ajoutée à récupérer</span><span>${f(cop)}</span></div>`;
      h+=`<div class="psr"><span>À récupérer total après paiement</span><span>${f(Math.max(0,bal+cop))}</span></div>`;
      h+=`<div class="psr tot"><span>Je débourse maintenant</span><span class="c-green">${f(total)}</span></div>`;
    }
  } else {
    const pt=document.querySelector('input[name="pt"]:checked')?.value||'ech';
    const nb=parseInt(document.getElementById('nnb')?.value)||1;
    const m=pt==='tot'?c.restant:sumInstAmounts(r,r.pays,nb);
    const np=pt==='tot'?r.total_inst:Math.min(r.total_inst,r.pays+nb);
    const nd=nextDueAfter(r,np);
    h+=`<div class="psr"><span>Montant</span><span>${f(m)}</span></div>`;
    h+=`<div class="psr"><span>Prochaine échéance</span><span>${nd?fd(nd):'Aucune (soldé)'}</span></div>`;
    h+=`<div class="psr tot"><span>Je débourse</span><span class="c-green">${f(m)}</span></div>`;
  }
  document.getElementById('ps').innerHTML=h;
}

async function openLogs(){
  if(G.user_role!=='Moi')return;
  await loadLogs();
  G.lm=true;
  render();
}
function LM(){
  if(G.user_role!=='Moi')return '';
  return `<div class="overlay" onclick="if(event.target===this){G.lm=false;render()}"><div class="modal modal-settings">
    <h2>📜 Historique des paiements</h2>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto">
      ${(G.logs||[]).length===0?'<div class="empty" style="padding:1rem">Aucun log pour le moment</div>':G.logs.map(l=>`<div class="s-card" style="padding:.75rem">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <div style="font-size:12px;font-weight:600;color:var(--text)">${l.actor||'—'} • ${l.action_type||'paiement'}</div>
          <div style="font-size:11px;color:var(--text3)">${l.created_at?new Date(l.created_at).toLocaleString('fr-FR'):'—'}</div>
        </div>
        <div style="margin-top:4px;font-size:13px;color:var(--text)">${l.marchand||'—'}</div>
        <div style="margin-top:2px;font-size:12px;color:#185FA5;font-weight:600">${f(l.amount||0)}</div>
        ${l.note?`<div style="margin-top:4px;font-size:11px;color:var(--text3)">${l.note}</div>`:''}
      </div>`).join('')}
    </div>
    <div class="macts"><button class="btn" onclick="G.lm=false;render()">Fermer</button></div>
  </div></div>`;
}

function salaireWidget(){
  // Calculer les charges fixes du mois courant
  const now = new Date();
  const curY = now.getFullYear(), curM = now.getMonth();
  const d = GMD(curY, curM);
  const totalEch = Math.round(d.mi.reduce((s,i)=>s+i.m,0)*100)/100;
  const totalAbos = (G.abos||[]).filter(a=>a.actif&&a.acheteur==='Moi'&&!a.partage).reduce((s,a)=>s+parseFloat(a.montant),0);
  const totalAbosPartage = (G.abos||[]).filter(a=>a.actif&&a.partage).reduce((s,a)=>s+(parseFloat(a.montant)-(a.partage_type==='perso'?parseFloat(a.montant_copine||0):parseFloat(a.montant)/2)),0);
  const charges = Math.round((totalEch + totalAbos + totalAbosPartage)*100)/100;
  
  if(G.salaire===0) return '';

  const reste = Math.round((G.salaire - charges)*100)/100;
  const color = reste > 0 ? '#276749' : '#A32D2D';
  const pct = Math.min(100, Math.max(0, Math.round((charges/G.salaire)*100)));
  
  return `<div class="mbox" style="margin-bottom:1rem">
    <div class="mbox-t">💶 Salaire & Reste à vivre</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
      <div class="kpi"><div class="kpi-l">Salaire</div><div class="kpi-v" style="color:var(--text)">${f(G.salaire)}</div></div>
      <div class="kpi"><div class="kpi-l">Charges mois</div><div class="kpi-v c-red">${f(charges)}</div></div>
      <div class="kpi"><div class="kpi-l">Reste à vivre</div><div class="kpi-v" style="color:${color}">${f(reste)}</div></div>
    </div>
    <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden">
      <div style="width:${pct}%;height:100%;background:${pct>80?'#A32D2D':pct>60?'#BA7517':'#276749'};border-radius:4px;transition:width .3s"></div>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:3px;text-align:right">
      <span>Charges : ${pct}% du salaire</span>
    </div>
  </div>`;
}

function SM(){
  return`<div class="overlay" onclick="if(event.target===this){G.sm=false;render()}"><div class="modal modal-settings">
    <h2>⚙️ Réglages</h2>
    <div style="display:flex;flex-direction:column;gap:16px">

      <div class="s-card">
        <div class="s-head">Apparence</div>
        <div class="s-row">
          <span>🌙 Mode sombre</span>
          <button onclick="toggleDark()" style="padding:6px 16px;border-radius:20px;border:1px solid var(--border);background:${isDark?'#185FA5':'var(--card)'};color:${isDark?'#fff':'var(--text)'};font-size:12px;cursor:pointer;font-family:inherit;touch-action:manipulation">
            ${isDark?'Activé ✓':'Désactivé'}
          </button>
        </div>
      </div>

      <div class="s-card">
        <div class="s-head">Photo de fond (écran PIN)</div>
        <div class="s-photo-actions">
          <label class="s-upload-btn">
            🖼 Choisir une photo
            <input type="file" accept="image/*" style="display:none" onchange="uploadBg(this)">
          </label>
          <button onclick="removeBg()" style="padding:7px 14px;border-radius:8px;border:1px solid #F09595;color:#A32D2D;background:var(--card);font-size:12px;cursor:pointer;font-family:inherit;touch-action:manipulation">Supprimer</button>
        </div>
      </div>

      <div class="s-card">
        <div class="s-head">💶 Salaire brut mensuel</div>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="sal-input" type="number" step="100" value="${G.salaire||''}" placeholder="Ex: 2500" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:13px;font-family:inherit">
          <button onclick="saveSalaire()" class="btn btn-p">Enregistrer</button>
        </div>
        ${G.salaire>0?`<div style="font-size:11px;color:var(--text3);margin-top:6px">Net estimé (~77%) : <strong style="color:#276749">${f(Math.round(G.salaire*0.77*100)/100)}</strong></div>`:''}
      </div>

      <div class="s-card">
        <div class="s-head">🏷️ Catégories</div>
        <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:10px;max-height:180px;overflow-y:auto">
          ${G.cats.map(cat=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:13px;color:var(--text)">${cat.icon} ${cat.nom}</span>
            <button onclick="deleteCat('${cat.id}')" style="background:none;border:none;color:#A32D2D;cursor:pointer;font-size:13px;padding:2px 6px;touch-action:manipulation">✕</button>
          </div>`).join('')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <input id="cat-icon" value="🏷️" style="width:44px;padding:6px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:16px;text-align:center;font-family:inherit">
          <input id="cat-nom" placeholder="Nom de la catégorie" style="flex:1;min-width:100px;padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:13px;font-family:inherit">
          <button onclick="addCat()" class="btn btn-p" style="white-space:nowrap">+ Ajouter</button>
        </div>
      </div>

      <div class="s-card">
        <div class="s-head">🔔 Rappels par email</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <input id="email-input" type="email" value="${G.email||''}" placeholder="ton@email.com" style="padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:13px;font-family:inherit">
          <div class="s-actions">
            <button onclick="saveEmail()" class="btn btn-p">💾 Enregistrer</button>
            <button onclick="sendTestEmail()" class="btn">🔔 Déclencher les rappels</button>
          </div>
          <button onclick="checkEmailStatus()" class="btn" style="width:100%">🧪 Diagnostic email</button>
          <div style="font-size:11px;color:var(--text3)">Tu recevras un email 7 jours avant chaque échéance. Le bouton déclenche les rappels côté serveur, mais il ne confirme pas la réception dans ta boîte mail.</div>
        </div>
      </div>

      ${G.user_role==='Moi'?`<div class="s-card">
        <div class="s-head">Codes PIN (Moi / Copine)</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <input id="np-m" type="tel" maxlength="4" placeholder="PIN Moi (4 chiffres)" style="padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:13px;font-family:inherit">
          <input id="np-c" type="tel" maxlength="4" placeholder="PIN Copine (4 chiffres)" style="padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:13px;font-family:inherit">
          <button onclick="SPC()" class="btn btn-p" style="align-self:flex-end">Enregistrer les PIN</button>
        </div>
      </div>`:''}

    </div>
    <div class="macts"><button class="btn" onclick="G.sm=false;render()">Fermer</button></div>
  </div></div>`;
}

function OE(id){G.eid=id||'new';render();}
function OP(id){G.pid=id;render();setTimeout(UPS,50);}

async function TR(id,cur){
  const r=G.rows.find(x=>x.id===id);if(!r||!r.partage)return;
  const c=calc(r);
  if(cur){
    setCopCredit(id,c.cc);
    await saveCopCredit();
    T('⏳ Marqué non remboursé');
  }else{
    setCopCredit(id,0);
    await saveCopCredit();
    T('✓ Marqué remboursé');
  }
  render();
}
async function DR(id){
  if(!confirm('Archiver ou supprimer définitivement ?')) return;
  // On archive plutôt que supprimer
  await SB.from('echeances').update({archive:true}).eq('id',id);
  await LD();render();T('Archivé 🗃️');
}
async function deleteForever(id){
  if(!confirm('Supprimer DÉFINITIVEMENT ? Cette action est irréversible.')) return;
  await SB.from('echeances').delete().eq('id',id);
  await LD();render();T('Supprimé définitivement');
}

async function SR(id){
  const marchand=document.getElementById('em').value.trim();
  const pays=parseInt(document.getElementById('ep').value)||0;
  const total_inst=parseInt(document.getElementById('et').value)||4;
  const due=document.getElementById('ed').value;
  const acheteur=document.getElementById('ea').value;
  const pav=document.getElementById('epa').value;
  const partage=pav!=='non';const partage_type=pav==='non'?'50/50':pav;
  const source=document.getElementById('esr').value;
  const notes=document.getElementById('en').value.trim();
  const categorie=document.getElementById('ecat')?.value||'';
  const vt=document.getElementById('evt').value;
  if(!marchand||!due){alert('Marchand et date obligatoires');return;}
  let versement=0,montant_total=0,versements_perso=null;
  if(vt==='perso'){
    const sc2=partage&&partage_type==='perso';
    versements_perso=[];let tot=0;
    for(let i=0;i<total_inst;i++){
      const mv=parseFloat(document.getElementById(`vpm_${i}`)?.value)||0;
      const cv2=sc2?(parseFloat(document.getElementById(`vpc_${i}`)?.value)||0):0;
      versements_perso.push({montant:mv,copine_montant:cv2});tot+=mv;
    }
    montant_total=tot;versement=versements_perso[0]?.montant||0;
  } else if(partage&&partage_type==='perso'){
    // Versements égaux mais partage personnalisé → sauvegarder les parts copine
    versements_perso=[];
    for(let i=0;i<total_inst;i++){
      const cv2=parseFloat(document.getElementById(`vpc_${i}`)?.value)||0;
      versements_perso.push({montant:parseFloat(document.getElementById('ev')?.value)||0,copine_montant:cv2});
    }
    versement=parseFloat(document.getElementById('ev')?.value)||0;
    if(!versement){alert('Montant du versement manquant');return;}
    const mr=document.getElementById('ett')?.value;
    montant_total=mr?parseFloat(mr):versement*total_inst;
  } else {
    versement=parseFloat(document.getElementById('ev')?.value)||0;
    if(!versement){alert('Montant du versement manquant');return;}
    const mr=document.getElementById('ett')?.value;
    montant_total=mr?parseFloat(mr):versement*total_inst;
  }
  const item={marchand,versement,montant_total,versement_type:vt,versements_perso,pays,total_inst,due,acheteur,partage,partage_type,source,notes,categorie};
  if(id==='new'){await SB.from('echeances').insert({...item,rembourse:false});T('Ajouté ✓');}
  else{await SB.from('echeances').update(item).eq('id',id);T('Modifié ✓');}
  await LD();G.eid=null;render();
}

async function CP(id){
  const r=G.rows.find(x=>x.id===id);if(!r)return;
  const today=new Date().toISOString().split('T')[0];
  const c=calc(r);
  let u={};

  if(r.partage){
    const bal=getCopCredit(id);
    const rest=Math.max(0,r.total_inst-r.pays);
    const totalFuture=sumCopShares(r,r.pays,rest);
    const qui=document.querySelector('input[name="qui"]:checked')?.value||'moi';
    if(qui==='cop'){
      const mode=document.querySelector('input[name="cpay"]:checked')?.value||'one';
      const one=(bal>0?Math.min(c.cc,bal):c.cc);
      const all=(bal>0?bal:Math.max(0,totalFuture+bal));
      const amt=Math.max(0,mode==='all'?all:one);
      if(amt<=0){T('Rien à rembourser');return;}
      setCopCredit(id,bal-amt);
      await saveCopCredit();
      await logPayment({actionType:'copine_rembourse',marchand:r.marchand,echeanceId:id,amount:amt,note:mode==='all'?'Remboursement total':'Remboursement partiel'});
      await loadLogs();
      G.pid=null;render();T(`💑 Remboursé : ${f(amt)}`);
      return;
    } else {
      if(c.pd){alert('Tu as déjà payé ce mois-ci.');return;}
      const nb=parseInt(document.getElementById('qnb')?.value)||1;
      const np=Math.min(r.total_inst,r.pays+nb);
      const nd=nextDueAfter(r,np);
      const copAdd=sumCopShares(r,r.pays,np-r.pays);
      const totalPaid=sumInstAmounts(r,r.pays,np-r.pays);
      u={last_paid_date:today,pays:np};
      if(nd)u.due=nd;
      setCopCredit(id,bal+copAdd);
      await SB.from('echeances').update(u).eq('id',id);
      await saveCopCredit();
      await logPayment({actionType:'paiement_partage',marchand:r.marchand,echeanceId:id,amount:totalPaid,note:`${np-r.pays} échéance(s) payée(s)`});
      await LD();G.pid=null;render();
      T(nd?`Payé ✓ — Prochaine : ${fd(nd)}`:'Payé ✓ — Achat soldé');
      return;
    }
  } else {
    const pt=document.querySelector('input[name="pt"]:checked')?.value||'ech';
    let amount=0;
    let paidCount=0;
    if(pt==='tot'){
      u={last_paid_date:today,pays:r.total_inst};
      amount=c.restant;
      paidCount=r.total_inst-r.pays;
    }else{
      const nb=parseInt(document.getElementById('nnb')?.value)||1;
      const np=Math.min(r.total_inst,r.pays+nb);
      const nd=nextDueAfter(r,np);
      u={last_paid_date:today,pays:np};
      if(nd)u.due=nd;
      amount=sumInstAmounts(r,r.pays,np-r.pays);
      paidCount=np-r.pays;
    }
    await logPayment({actionType:'paiement',marchand:r.marchand,echeanceId:id,amount,note:`${paidCount} échéance(s) payée(s)`});
  }

  await SB.from('echeances').update(u).eq('id',id);
  await loadLogs();
  await LD();G.pid=null;render();
  T(u.due?`Payé ✓ — Prochaine : ${fd(u.due)}`:'Payé ✓ — Achat soldé');
}

async function SPC(){
  if(G.user_role!=='Moi'){alert('Action réservée à Moi');return;}
  const vm=document.getElementById('np-m')?.value.trim();
  const vc=document.getElementById('np-c')?.value.trim();
  if(!/^\d{4}$/.test(vm)||!/^\d{4}$/.test(vc)){alert('2 PIN de 4 chiffres requis');return;}
  await SB.from('app_config').upsert([
    {key:'pin_moi',value:vm},
    {key:'pin_copine',value:vc}
  ]);
  pinMoi=vm;pinCop=vc;
  render();T('PIN Moi/Copine mis à jour ✓');
}

function T(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2500);}
async function uploadBg(input){
  const file=input.files[0];
  if(!file)return;
  // Redimensionner et compresser l'image avant stockage
  const reader=new FileReader();
  reader.onload=async(e)=>{
    const img=new Image();
    img.onload=async()=>{
      // Redimensionner à max 1200px pour limiter la taille
      const MAX=1200;
      const canvas=document.createElement('canvas');
      let w=img.width,h=img.height;
      if(w>h&&w>MAX){h=Math.round(h*MAX/w);w=MAX;}
      else if(h>w&&h>MAX){w=Math.round(w*MAX/h);h=MAX;}
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      const dataUrl=canvas.toDataURL('image/jpeg',0.7);
      // Sauvegarder dans Supabase
      await SB.from('app_config').upsert({key:'bg_photo',value:dataUrl});
      applyBg(dataUrl);
      T('Photo enregistrée ✓');
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

// Dark mode
let isDark = localStorage.getItem('dark') === '1';
function applyDark(){
  document.body.classList.toggle('dark', isDark);
  const btn = document.getElementById('dark-btn');
  if(btn) btn.textContent = isDark ? '☀️' : '🌙';
}
function toggleDark(){
  isDark = !isDark;
  localStorage.setItem('dark', isDark ? '1' : '0');
  applyDark();
  if(G.sm) render(); // re-render pour mettre à jour le bouton dans les réglages
  setTimeout(drawChart, 50);
}
applyDark();

// Graphique - reconstruit l'historique des paiements déjà effectués
let chartInstance = null;

function drawChartComp(canvas, curY, curM){
  // Comparer les 6 derniers mois de cette année vs l'année précédente
  const labels=[], dataN=[], dataN1=[];
  for(let i=5;i>=0;i--){
    const m = curM - i;
    const y = curY + Math.floor(m/12);
    const mm = ((m%12)+12)%12;
    const label = new Date(y,mm,1).toLocaleDateString('fr-FR',{month:'short',year:'2-digit'});
    labels.push(label);

    // Simuler les versements passés pour ce mois
    let totalN=0, totalN1=0;
    G.rows.forEach(r=>{
      if(r.pays===0)return;
      const v=parseFloat(r.versement)||0;
      if(!v)return;
      const nextDue=new Date(r.due+'T12:00:00');
      for(let p=1;p<=r.pays;p++){
        const pd=new Date(nextDue.getTime());
        pd.setMonth(pd.getMonth()-p);
        if(pd.getFullYear()===y&&pd.getMonth()===mm){
          let mv=v;
          const vIdx=r.pays-p;
          if(r.versement_type==='perso'&&r.versements_perso&&r.versements_perso[vIdx]&&parseFloat(r.versements_perso[vIdx].montant))
            mv=parseFloat(r.versements_perso[vIdx].montant);
          totalN+=mv;
        }
        // Même mois l'année précédente
        if(pd.getFullYear()===(y-1)&&pd.getMonth()===mm){
          let mv=v;
          const vIdx=r.pays-p;
          if(r.versement_type==='perso'&&r.versements_perso&&r.versements_perso[vIdx]&&parseFloat(r.versements_perso[vIdx].montant))
            mv=parseFloat(r.versements_perso[vIdx].montant);
          totalN1+=mv;
        }
      }
    });
    dataN.push(Math.round(totalN*100)/100);
    dataN1.push(Math.round(totalN1*100)/100);
  }

  const dark=document.body.classList.contains('dark');
  const tc=dark?'#94a3b8':'#718096';
  const gc=dark?'#334155':'#e2e8f0';

  chartInstance=new Chart(canvas,{
    type:'bar',
    data:{
      labels,
      datasets:[
        {label:`📅 ${curY}`,data:dataN,backgroundColor:'#185FA5CC',borderRadius:4},
        {label:`📅 ${curY-1}`,data:dataN1,backgroundColor:'#854F0B88',borderRadius:4},
      ]
    },
    options:{
      responsive:true,
      plugins:{
        legend:{labels:{color:tc,font:{size:11},boxWidth:12}},
        tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label} : ${ctx.parsed.y.toLocaleString('fr-FR',{minimumFractionDigits:2})} €`}}
      },
      scales:{
        x:{ticks:{color:tc,font:{size:10}},grid:{color:gc}},
        y:{ticks:{color:tc,font:{size:10},callback:v=>v+' €'},grid:{color:gc},beginAtZero:true}
      }
    }
  });
}

function drawChart(){
  if(typeof Chart==='undefined') return;
  const canvas = document.getElementById('chart-mois');
  if(!canvas) return;
  if(chartInstance){ chartInstance.destroy(); chartInstance = null; }

  const now = new Date();
  const curY = now.getFullYear(), curM = now.getMonth();

  // Mode comparaison N vs N-1
  if(G.comp){
    drawChartComp(canvas, curY, curM);
    return;
  }

  const months = [];

  if(!G.sf){
    for(let i=1;i<=6;i++){
      const d=new Date(curY,curM+i,1);
      months.push({y:d.getFullYear(),m:d.getMonth(),
        label:d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}),
        moi:0,copine:0,partage:0,pMoi:0,pCop:0,
        itemsMoi:[],itemsCop:[],itemsPar:[]});
    }
    G.rows.forEach(r=>{
      const rest=r.total_inst-r.pays;
      if(rest<=0)return;
      for(let p=0;p<rest;p++){
        const dd=new Date(r.due+'T12:00:00');
        dd.setMonth(dd.getMonth()+p);
        const slot=months.find(x=>x.y===dd.getFullYear()&&x.m===dd.getMonth());
        if(!slot)continue;
        const vIdx=r.pays+p;
        let m=parseFloat(r.versement)||0;
        if(r.versement_type==='perso'&&r.versements_perso&&r.versements_perso[vIdx]&&parseFloat(r.versements_perso[vIdx].montant))
          m=parseFloat(r.versements_perso[vIdx].montant);
        if(!m)continue;
        // Part copine sur cet achat partagé
        let mc=0;
        if(r.partage){
          if(r.partage_type==='perso'&&r.versements_perso&&r.versements_perso[vIdx]&&parseFloat(r.versements_perso[vIdx].copine_montant))
            mc=parseFloat(r.versements_perso[vIdx].copine_montant);
          else mc=m/2;
        }
        if(r.partage){
          slot.pMoi+=m-mc; slot.pCop+=mc;
          slot.partage+=m;
          slot.itemsPar.push({n:r.marchand,total:m,maPart:m-mc,copPart:mc});
        } else if(r.acheteur==='Moi'){
          slot.moi+=m;
          slot.itemsMoi.push({n:r.marchand,m});
        } else {
          slot.copine+=m;
          slot.itemsCop.push({n:r.marchand,m});
        }
      }
    });
    // Abonnements : 1 versement par mois futur
    (G.abos||[]).filter(a=>a.actif).forEach(a=>{
      const amt=parseFloat(a.montant)||0;
      const mc=a.partage?(a.partage_type==='perso'?parseFloat(a.montant_copine||0):amt/2):0;
      months.forEach(slot=>{
        if(a.partage){
          slot.partage+=amt; slot.pMoi+=amt-mc; slot.pCop+=mc;
          slot.itemsPar.push({n:a.nom+'🔄',total:amt,maPart:amt-mc,copPart:mc});
        } else if(a.acheteur==='Moi'){
          slot.moi+=amt; slot.itemsMoi.push({n:a.nom+'🔄',m:amt});
        } else {
          slot.copine+=amt; slot.itemsCop.push({n:a.nom+'🔄',m:amt});
        }
      });
    });
  } else {
    for(let i=5;i>=0;i--){
      const d=new Date(curY,curM-i,1);
      months.push({y:d.getFullYear(),m:d.getMonth(),
        label:d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}),
        moi:0,copine:0,partage:0,pMoi:0,pCop:0,
        itemsMoi:[],itemsCop:[],itemsPar:[]});
    }
    G.rows.forEach(r=>{
      if(r.pays===0)return;
      const v=parseFloat(r.versement)||0;
      if(!v)return;
      const nextDue=new Date(r.due+'T12:00:00');
      for(let p=1;p<=r.pays;p++){
        const pd=new Date(nextDue.getTime());
        pd.setMonth(pd.getMonth()-p);
        const slot=months.find(x=>x.y===pd.getFullYear()&&x.m===pd.getMonth());
        if(!slot)continue;
        const vIdx=r.pays-p;
        let m=v;
        if(r.versement_type==='perso'&&r.versements_perso&&r.versements_perso[vIdx]&&parseFloat(r.versements_perso[vIdx].montant))
          m=parseFloat(r.versements_perso[vIdx].montant);
        let mc=0;
        if(r.partage){
          if(r.partage_type==='perso'&&r.versements_perso&&r.versements_perso[vIdx]&&parseFloat(r.versements_perso[vIdx].copine_montant))
            mc=parseFloat(r.versements_perso[vIdx].copine_montant);
          else mc=m/2;
        }
        if(r.partage){
          slot.pMoi+=m-mc; slot.pCop+=mc;
          slot.partage+=m;
          slot.itemsPar.push({n:r.marchand,total:m,maPart:m-mc,copPart:mc});
        } else if(r.acheteur==='Moi'){
          slot.moi+=m; slot.itemsMoi.push({n:r.marchand,m});
        } else {
          slot.copine+=m; slot.itemsCop.push({n:r.marchand,m});
        }
      }
    });
    // Abonnements dans l'historique : 1 versement par mois passé aussi
    (G.abos||[]).filter(a=>a.actif).forEach(a=>{
      const amt=parseFloat(a.montant)||0;
      const mc=a.partage?(a.partage_type==='perso'?parseFloat(a.montant_copine||0):amt/2):0;
      months.forEach(slot=>{
        if(a.partage){
          slot.partage+=amt; slot.pMoi+=amt-mc; slot.pCop+=mc;
          slot.itemsPar.push({n:a.nom+'🔄',total:amt,maPart:amt-mc,copPart:mc});
        } else if(a.acheteur==='Moi'){
          slot.moi+=amt; slot.itemsMoi.push({n:a.nom+'🔄',m:amt});
        } else {
          slot.copine+=amt; slot.itemsCop.push({n:a.nom+'🔄',m:amt});
        }
      });
    });
  }

  const dark=document.body.classList.contains('dark');
  const tc=dark?'#94a3b8':'#718096';
  const gc=dark?'#334155':'#e2e8f0';
  const fa=G.cfa;

  // Calculer les données selon le filtre
  // moi_p = moi solo + ma part des partagés (une seule barre)
  // cop_p = copine solo + part copine des partagés (une seule barre)
  const getData = slot => {
    if(fa==='tous')      return {moi:slot.moi, copine:slot.copine, partage:slot.partage};
    if(fa==='moi_s')     return {moi:slot.moi, copine:0, partage:0};
    if(fa==='moi_p')     return {moi:slot.moi+slot.pMoi, copine:0, partage:0}; // une barre
    if(fa==='cop_s')     return {moi:0, copine:slot.copine, partage:0};
    if(fa==='cop_p')     return {moi:0, copine:slot.copine+slot.pCop, partage:0}; // une barre
    if(fa==='par')       return {moi:0, copine:0, partage:slot.partage};
    return {moi:slot.moi, copine:slot.copine, partage:slot.partage};
  };

  const datasets=[];
  const moiLabel   = fa==='moi_p'?'👤 Moi (+ partagés)':'👤 Moi';
  const copLabel   = fa==='cop_p'?'💑 Copine (+ partagés)':'💑 Copine';

  if(['tous','moi_s','moi_p'].includes(fa))
    datasets.push({label:moiLabel, data:months.map(s=>Math.round(getData(s).moi*100)/100), backgroundColor:'#185FA5CC', borderRadius:4});
  if(['tous','cop_s','cop_p'].includes(fa))
    datasets.push({label:copLabel, data:months.map(s=>Math.round(getData(s).copine*100)/100), backgroundColor:'#854F0BCC', borderRadius:4});
  if(['tous','par'].includes(fa))
    datasets.push({label:'🤝 Partagé', data:months.map(s=>Math.round(getData(s).partage*100)/100), backgroundColor:'#27500ACC', borderRadius:4});

  chartInstance=new Chart(canvas,{
    type:'bar',
    data:{labels:months.map(x=>x.label), datasets},
    options:{
      responsive:true,
      plugins:{
        legend:{labels:{color:tc,font:{size:11},boxWidth:12}},
        tooltip:{enabled:false}
      },
      interaction:{mode:'index',intersect:false},
      scales:{
        x:{ticks:{color:tc,font:{size:10}},grid:{color:gc}},
        y:{ticks:{color:tc,font:{size:10},callback:v=>v+' €'},grid:{color:gc},beginAtZero:true}
      }
    }
  });

  // Mobile : tap pour afficher détail dans un panneau sous le graphique
  function showDetail(idx){
    const slot = months[idx];
    if(!slot) return;
    const el = document.getElementById('chart-detail');
    if(!el) return;
    const fa2 = G.cfa;
    let html = '<div style="font-weight:600;margin-bottom:6px;color:var(--text)">'+slot.label+'</div>';

    const isAbo = i => i.n && i.n.endsWith('🔄');
    // Helper : affiche une liste d'items avec son total
    function sec(title, color, items, key){
      if(!items.length) return '';
      const tot = items.reduce((s,i)=>s+i[key],0);
      let h='<div style="font-weight:600;color:'+color+';margin-top:8px;margin-bottom:3px">'+title+'</div>';
      items.forEach(i=>{
        const nom = i.n.replace('🔄','').trim();
        h+='<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid var(--border)"><span>'+nom+'</span><span style="font-weight:600">'+i[key].toLocaleString('fr-FR',{minimumFractionDigits:2})+' €</span></div>';
      });
      h+='<div style="display:flex;justify-content:space-between;padding:3px 0;font-weight:700;color:'+color+'"><span>Total</span><span>'+tot.toLocaleString('fr-FR',{minimumFractionDigits:2})+' €</span></div>';
      return h;
    }
    // Séparer achats normaux et abonnements
    if(['tous','moi_s','moi_p'].includes(fa2)){
      html += sec('👤 Moi','#185FA5', slot.itemsMoi.filter(i=>!isAbo(i)),'m');
      html += sec('🔄 Abonnements','#185FA5', slot.itemsMoi.filter(isAbo),'m');
    }
    if(fa2==='moi_p'){
      html += sec('💛 Partagés','#185FA5', slot.itemsPar.filter(i=>!isAbo(i)),'maPart');
      html += sec('🔄 Abonnements partagés','#185FA5', slot.itemsPar.filter(isAbo),'maPart');
    }
    if(['tous','cop_s','cop_p'].includes(fa2)){
      html += sec('💑 Copine','#854F0B', slot.itemsCop.filter(i=>!isAbo(i)),'m');
      html += sec('🔄 Abonnements','#854F0B', slot.itemsCop.filter(isAbo),'m');
    }
    if(fa2==='cop_p'){
      html += sec('💛 Partagés','#854F0B', slot.itemsPar.filter(i=>!isAbo(i)),'copPart');
      html += sec('🔄 Abonnements partagés','#854F0B', slot.itemsPar.filter(isAbo),'copPart');
    }
    if(['tous','par'].includes(fa2)){
      html += sec('🤝 Partagés','#27500A', slot.itemsPar.filter(i=>!isAbo(i)),'total');
      html += sec('🔄 Abonnements partagés','#27500A', slot.itemsPar.filter(isAbo),'total');
    }
    // Séparer achats normaux et abonnements (🔄)
    const isMoiAbo  = i => i.n && i.n.includes('🔄');
    const tAboMoi   = Math.round(slot.itemsMoi.filter(isMoiAbo).reduce((s,i)=>s+i.m,0)*100)/100;
    const tAboMoiP  = Math.round(slot.itemsPar.filter(isMoiAbo).reduce((s,i)=>s+i.maPart,0)*100)/100;
    const tAboCopP  = Math.round(slot.itemsPar.filter(isMoiAbo).reduce((s,i)=>s+i.copPart,0)*100)/100;
    const tAboCop   = Math.round(slot.itemsCop.filter(isMoiAbo).reduce((s,i)=>s+i.m,0)*100)/100;
    const tAchatMoi = Math.round(slot.itemsMoi.filter(i=>!isMoiAbo(i)).reduce((s,i)=>s+i.m,0)*100)/100;
    const tAchatCop = Math.round(slot.itemsCop.filter(i=>!isMoiAbo(i)).reduce((s,i)=>s+i.m,0)*100)/100;
    const tAchatPar = Math.round(slot.itemsPar.filter(i=>!isMoiAbo(i)).reduce((s,i)=>s+i.total,0)*100)/100;
    const tPar      = Math.round(slot.partage*100)/100;
    const tpM       = Math.round(slot.pMoi*100)/100;
    const tpC       = Math.round(slot.pCop*100)/100;
    const tMs       = Math.round(slot.moi*100)/100;
    const tCs       = Math.round(slot.copine*100)/100;
    // Total abonnements (toutes catégories selon filtre)
    const tAbo = Math.round((tAboMoi + tAboCop + (slot.itemsPar.filter(isMoiAbo).reduce((s,i)=>s+i.total,0)))*100)/100;
    // Total achats sans abonnements
    const tAchat = Math.round((tAchatMoi + tAchatCop + tAchatPar)*100)/100;

    // Total = somme exacte de ce qui est affiché dans les sections
    // Pour "Moi seul" : achats moi + abonnements moi (pas les partagés)
    const grandMoi  = slot.itemsMoi.reduce((s,i)=>s+i.m, 0);
    const grandCop  = slot.itemsCop.reduce((s,i)=>s+i.m, 0);
    const grandPar  = slot.itemsPar.reduce((s,i)=>{
      if(fa2==='moi_p')  return s+i.maPart;
      if(fa2==='cop_p')  return s+i.copPart;
      return s+i.total;
    }, 0);
    let grand = 0;
    if(['tous','moi_s','moi_p'].includes(fa2)) grand += grandMoi;
    if(['tous','cop_s','cop_p'].includes(fa2)) grand += grandCop;
    if(['tous','moi_p','cop_p','par'].includes(fa2)) grand += grandPar;
    grand = Math.round(grand*100)/100;

    html += '<div style="margin-top:8px;padding-top:6px;border-top:2px solid var(--border)">';
    html += rowBold('💰 Total', grand);
    html += '</div>';

    function row(label, val, color){
      return '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:12px"><span style="color:var(--text3)">'+label+'</span><span style="font-weight:600;color:'+color+'">'+val.toLocaleString('fr-FR',{minimumFractionDigits:2})+' €</span></div>';
    }
    function rowBold(label, val){
      return '<div style="display:flex;justify-content:space-between;padding:4px 0;margin-top:4px;border-top:1px solid var(--border);font-size:13px;font-weight:700"><span>'+label+'</span><span>'+val.toLocaleString('fr-FR',{minimumFractionDigits:2})+' €</span></div>';
    }

    el.innerHTML = html;
    el.style.display = 'block';
  }

  canvas.onclick = function(e){
    const pts = chartInstance.getElementsAtEventForMode(e,'index',{intersect:false},true);
    if(pts.length) showDetail(pts[0].index);
  };
}

// ── GRAPHIQUE CATÉGORIES ────────────────────────────────────
let chartCatInstance = null;
const catColors = ['#185FA5','#854F0B','#276749','#A32D2D','#7C3AED','#DC2626','#059669','#F59E0B','#6366F1','#84CC16'];

function getCategoryTotals(){
  const cats = {};
  G.rows.forEach(r=>{
    const cat = r.categorie || 'Sans catégorie';
    if(!cats[cat]) cats[cat] = 0;
    const c = calc(r);
    cats[cat] += c.restant > 0 ? c.total : 0;
  });
  return Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,10);
}

function drawCategoryChart(){
  if(typeof Chart==='undefined') return;
  const canvas = document.getElementById('chart-cat');
  if(!canvas) return;
  
  const data = getCategoryTotals();
  if(data.length === 0){
    document.getElementById('cat-legend').innerHTML='<div style="color:var(--text3);font-size:12px">Aucune dépense</div>';
    return;
  }
  
  if(chartCatInstance){ chartCatInstance.destroy(); chartCatInstance = null; }
  
  const labels = data.map(([cat])=>cat);
  const values = data.map(([,val])=>val);
  const colors = data.map((_,i)=>catColors[i % catColors.length]);
  
  chartCatInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card'),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx){
              return f(ctx.parsed);
            }
          }
        }
      }
    }
  });
  
  // Légende
  const legend = document.getElementById('cat-legend');
  legend.innerHTML = labels.map((label,i)=>`
    <div style="display:flex;align-items:center;gap:8px;font-size:12px">
      <div style="width:16px;height:16px;border-radius:3px;background:${colors[i]}"></div>
      <span style="color:var(--text)">${label}</span>
      <span style="color:var(--text3);margin-left:auto">${f(values[i])}</span>
    </div>
  `).join('');
}

async function removeBg(){
  await SB.from('app_config').upsert({key:'bg_photo',value:''});
  const ps=document.getElementById('pin-screen');
  if(ps){ps.style.backgroundImage='';const ov=document.getElementById('pin-overlay');if(ov)ov.style.display='none';}
  T('Photo supprimée');
}


async function saveSalaire(){
  const val = parseFloat(document.getElementById('sal-input')?.value)||0;
  await SB.from('app_config').upsert({key:'salaire_brut',value:String(val)});
  G.salaire = val;
  render();
  T('Salaire enregistré ✓');
}

async function addCat(){
  const icon = document.getElementById('cat-icon')?.value.trim()||'🏷️';
  const nom = document.getElementById('cat-nom')?.value.trim();
  if(!nom){alert('Nom obligatoire');return;}
  await SB.from('categories').insert({nom,icon,couleur:'#185FA5'});
  await LD();render();T('Catégorie ajoutée ✓');
}

async function deleteCat(id){
  if(!confirm('Supprimer cette catégorie ?'))return;
  await SB.from('categories').delete().eq('id',id);
  await LD();render();T('Catégorie supprimée');
}


// ── ARCHIVES ────────────────────────────────────────────────────
function renderArchives(){
  const rows = G.archive_rows;
  if(rows.length===0) return '<div class="empty">🗃️ Aucun achat archivé</div>';
  return '<div style="margin-top:1rem">' +
    '<div style="font-size:13px;font-weight:600;color:var(--text3);margin-bottom:8px">🗃️ Achats archivés</div>' +
    rows.map(r=>{
      const total = parseFloat(r.montant_total)||0;
      const deja = (parseFloat(r.versement)||0) * r.pays;
      return '<div class="card" style="opacity:.8">' +
        '<div class="ch">' +
          '<div><div class="ctitle">'+r.marchand+'</div>' +
          (r.notes?'<div class="cnote">'+r.notes+'</div>':'') + '</div>' +
          '<div style="text-align:right"><div style="font-size:12px;color:var(--text3)">'+r.pays+'/'+r.total_inst+' versements</div>' +
          '<div style="font-size:12px;font-weight:600;color:#276749">'+f(deja)+' payé</div></div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;margin-top:6px">' +
          '<button class="btn btn-sm btn-p" onclick="restoreArchive(\''+r.id+'\')">↩️ Restaurer</button>' +
          '<button class="btn btn-sm btn-d" onclick="deleteForever(\''+r.id+'\')">🗑️ Supprimer</button>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

async function restoreArchive(id){
  await SB.from('echeances').update({archive:false}).eq('id',id);
  await LD(); render(); T('Restauré ✓');
}

// ── COMPARAISON MOIS VS MOIS ─────────────────────────────────────
// Intégré dans drawChart via un mode toggle G.sf2
// G.sf=false → prochains mois  G.sf=true → historique  G.sf2=true → comparaison N-1

// ── PRÉVISION ANNUELLE ───────────────────────────────────────────
function previsionAnnuelle(){
  const now = new Date();
  const curY = now.getFullYear();
  const months = [];
  let totalAnnuel = 0;

  for(let m=0; m<12; m++){
    const d = GMD(curY, m);
    const abos = aboForMonth(curY, m);
    const allMi = [...d.mi, ...abos.mi];
    const allCo = [...d.co, ...abos.co];
    const tm = allMi.reduce((s,i)=>s+i.m,0);
    const tc = allCo.reduce((s,i)=>s+i.m,0);
    const tp = allMi.filter(i=>i.p).reduce((s,i)=>s+i.m,0) + allCo.filter(i=>i.p).reduce((s,i)=>s+i.m,0);
    const total = Math.round((tm+tc+tp)*100)/100;
    totalAnnuel += total;
    months.push({
      label: new Date(curY,m,1).toLocaleDateString('fr-FR',{month:'short'}),
      moi: Math.round(tm*100)/100,
      copine: Math.round(tc*100)/100,
      partage: Math.round(tp*100)/100,
      total,
      isPast: m < now.getMonth()
    });
  }

  return `<div class="chart-box" style="margin-bottom:1rem">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
      <h3 style="margin:0">📅 Prévision annuelle ${curY}</h3>
      <span style="font-size:12px;font-weight:600;color:var(--text3)">Total : ${f(Math.round(totalAnnuel*100)/100)}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:2px;align-items:end;height:80px">
      ${months.map((m,i)=>{
        const maxVal = Math.max(...months.map(x=>x.total));
        const h = maxVal>0 ? Math.round((m.total/maxVal)*100) : 0;
        const isPast = m.isPast;
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;height:100%;justify-content:flex-end" title="${m.label}: ${f(m.total)}">
          <div style="width:100%;background:${isPast?'#185FA580':'#185FA5CC'};height:${h}%;border-radius:3px 3px 0 0;min-height:${m.total>0?'3px':'0'}"></div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:2px;margin-top:3px">
      ${months.map(m=>`<div style="text-align:center;font-size:9px;color:var(--text3)">${m.label}</div>`).join('')}
    </div>
    <div style="margin-top:10px;display:flex;flex-direction:column;gap:3px">
      ${months.map((m,i)=>m.total>0?`<div style="display:flex;justify-content:space-between;padding:3px 6px;border-radius:6px;background:${m.isPast?'var(--bg)':'var(--card)'};border:1px solid var(--border)">
        <span style="font-size:11px;color:${m.isPast?'var(--text3)':'var(--text)'};font-weight:${m.isPast?'400':'600'}">${m.label} ${m.isPast?'(passé)':''}</span>
        <span style="font-size:11px;font-weight:600;color:${m.isPast?'var(--text3)':'#185FA5'}">${f(m.total)}</span>
      </div>`:'').join('')}
    </div>
  </div>`;
}


async function saveEmail(){
  const val = document.getElementById('email-input')?.value.trim()||'';
  if(!val){alert('Adresse email obligatoire');return;}
  await SB.from('app_config').upsert({key:'email_rappel',value:val});
  G.email=val; T('Email enregistré ✓');
}

async function sendTestEmail(){
  try{
    T('Déclenchement des rappels...');
    const res = await fetch('/api/send-reminders', {
      method:'GET',
      headers:{Accept:'application/json'}
    });
    const data = await res.json();
    if(!res.ok||!data?.ok){
      throw new Error(data?.error||'Erreur envoi email');
    }
    T('✅ Rappels déclenchés: '+(data.echeances||0)+' échéance(s)');
  }catch(error){
    T('❌ Envoi impossible: '+(error?.message||'erreur inconnue'));
  }
}

async function checkEmailStatus(){
  try{
    T('Diagnostic en cours...');
    const res = await fetch('/api/email-status', {
      method:'GET',
      headers:{Accept:'application/json'}
    });
    const data = await res.json();
    if(!res.ok||!data?.checks){
      throw new Error(data?.error||'Diagnostic indisponible');
    }
    const checks = data.checks;
    const ok = checks.SUPABASE_URL && checks.SUPABASE_KEY && checks.RESEND_API_KEY && checks.REMINDER_FROM_EMAIL;
    const msg = [
      ok ? '✅ Config email OK' : '❌ Config email incomplète',
      `SUPABASE_URL: ${checks.SUPABASE_URL?'OK':'KO'}`,
      `SUPABASE_KEY: ${checks.SUPABASE_KEY?'OK':'KO'}`,
      `RESEND_API_KEY: ${checks.RESEND_API_KEY?'OK':'KO'}`,
      `REMINDER_FROM_EMAIL: ${checks.REMINDER_FROM_EMAIL?'OK':'KO'}`
    ].join('\n');
    alert(msg);
    T(ok?'Diagnostic OK ✓':'Diagnostic: config incomplète');
  }catch(error){
    T('❌ Diagnostic impossible: '+(error?.message||'erreur inconnue'));
  }
}

function exportPDF(){
  const now = new Date();
  const moisLabel = now.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  const k = kpis();
  const moisRows = G.rows.filter(r=>{
    const c2=calc(r);
    const due=new Date(r.due+'T12:00:00');
    return due.getMonth()===now.getMonth()&&due.getFullYear()===now.getFullYear();
  });

  let tableRows = moisRows.map(r=>{
    const c2=calc(r);
    return '<tr><td>'+r.marchand+'</td><td>'+r.acheteur+(r.partage?' (Partagé)':'')+'</td><td>'+f(c2.cv)+'</td><td>'+f(c2.deja)+'</td><td>'+f(c2.restant)+'</td><td>'+c2.st+'</td></tr>';
  }).join('');

  const totalPaye = moisRows.reduce((s,r)=>s+calc(r).deja,0);
  const totalReste = moisRows.reduce((s,r)=>s+calc(r).restant,0);
  tableRows += '<tr style="font-weight:bold;background:#EAF3DE"><td colspan="2">Total</td><td></td><td>'+f(totalPaye)+'</td><td>'+f(totalReste)+'</td><td></td></tr>';

  let aboRows = (G.abos||[]).filter(a=>a.actif).map(a=>{
    return '<tr><td>'+a.nom+'</td><td>'+f(parseFloat(a.montant))+'</td><td>J'+a.jour_prelevement+'</td><td>'+a.acheteur+(a.partage?' (Partagé)':'')+'</td></tr>';
  }).join('');

  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
    + 'body{font-family:Arial,sans-serif;padding:20px;color:#1a202c;font-size:12px}'
    + 'h1{color:#185FA5;font-size:20px;margin-bottom:5px}'
    + 'h2{font-size:14px;color:#4a5568;margin:16px 0 8px}'
    + '.kpi-row{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}'
    + '.kpi{background:#f7fafc;border-radius:8px;padding:10px 16px;min-width:100px}'
    + '.kpi-l{font-size:10px;color:#718096;text-transform:uppercase}'
    + '.kpi-v{font-size:16px;font-weight:bold;color:#185FA5}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:16px}'
    + 'th{background:#185FA5;color:white;padding:6px 8px;text-align:left;font-size:11px}'
    + 'td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px}'
    + 'tr:nth-child(even) td{background:#f7fafc}'
    + '.footer{margin-top:20px;font-size:10px;color:#a0aec0;text-align:center}'
    + '</style></head><body>'
    + '<h1>💛 MY Wallet — Récapitulatif '+moisLabel+'</h1>'
    + '<div style="color:#718096;font-size:11px;margin-bottom:12px">Généré le '+now.toLocaleDateString('fr-FR')+'</div>'
    + '<div class="kpi-row">'
    + '<div class="kpi"><div class="kpi-l">Total engagé</div><div class="kpi-v">'+f(k.te)+'</div></div>'
    + '<div class="kpi"><div class="kpi-l">Reste à payer</div><div class="kpi-v" style="color:#A32D2D">'+f(k.tr)+'</div></div>'
    + '<div class="kpi"><div class="kpi-l">Ma part</div><div class="kpi-v">'+f(k.mr)+'</div></div>'
    + '<div class="kpi"><div class="kpi-l">Part copine</div><div class="kpi-v" style="color:#854F0B">'+f(k.cr)+'</div></div>'
    + '</div>'
    + '<h2>📅 Échéances du mois</h2>'
    + '<table><thead><tr><th>Marchand</th><th>Acheteur</th><th>Versement</th><th>Payé</th><th>Restant</th><th>Statut</th></tr></thead>'
    + '<tbody>'+tableRows+'</tbody></table>'
    + '<h2>🔄 Abonnements actifs</h2>'
    + '<table><thead><tr><th>Nom</th><th>Montant</th><th>Jour</th><th>Acheteur</th></tr></thead>'
    + '<tbody>'+aboRows+'</tbody></table>'
    + '<div class="footer">MY Wallet 💛 — Rapport confidentiel</div>'
    + '</body></html>';

  const win = window.open('','_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(()=>win.print(), 500);
}