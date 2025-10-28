/* sql-lite.js — IndexedDB helper */
const DB_NAME = "ctrl_paqueteria_db_v1";
const DB_VERSION = 2; // bumped
let DB;
function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains('users')){
        const s = db.createObjectStore('users',{keyPath:'id',autoIncrement:true});
        s.createIndex('usuario','usuario',{unique:true});
      }
      if(!db.objectStoreNames.contains('domicilios')){
        const s = db.createObjectStore('domicilios',{keyPath:'id',autoIncrement:true});
        s.createIndex('calle','calle',{unique:false});
      }
      if(!db.objectStoreNames.contains('paquetes')){
        const s = db.createObjectStore('paquetes',{keyPath:'id',autoIncrement:true});
        s.createIndex('guia','guia',{unique:true});
        s.createIndex('nombre','nombre',{unique:false});
      }
      if(!db.objectStoreNames.contains('historial')){
        const s = db.createObjectStore('historial',{keyPath:'id',autoIncrement:true});
        s.createIndex('paqueteId','paqueteId',{unique:false});
        s.createIndex('fecha','fecha',{unique:false});
        s.createIndex('estado','estado',{unique:false});
      }
    };
    req.onsuccess = (e)=>{DB=e.target.result;resolve(DB)};
    req.onerror = (e)=>{reject(e)};
  });
}

function tx(storeName, mode='readwrite'){
  const t = DB.transaction([storeName], mode);
  return t.objectStore(storeName);
}

async function addItem(store, data){
  return new Promise((resolve,reject)=>{
    const st = tx(store);
    const req = st.add(data);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}
async function putItem(store, data){
  return new Promise((resolve,reject)=>{
    const st = tx(store);
    const req = st.put(data);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}
async function getByIndex(store, indexName, value){
  return new Promise((resolve,reject)=>{
    const st = tx(store,'readonly');
    const idx = st.index(indexName);
    const req = idx.get(value);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}
async function getAll(store){
  return new Promise((resolve,reject)=>{
    const st = tx(store,'readonly');
    const req = st.getAll();
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}
async function getByKey(store, key){
  return new Promise((resolve,reject)=>{
    const st = tx(store,'readonly');
    const req = st.get(key);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}
async function query(store, callback){
  return new Promise((resolve,reject)=>{
    const st = tx(store,'readonly');
    const req = st.openCursor();
    const out = [];
    req.onsuccess = (e)=>{
      const cur = e.target.result;
      if(!cur){ resolve(out); return; }
      const res = callback(cur);
      if(res !== false) out.push(cur.value);
      cur.continue();
    };
    req.onerror = (e)=>reject(e);
  });
}
