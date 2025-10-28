/* app.js final: SPA + recibidopor/entregadoPor + image viewer + validación de entregado */
(async function(){
  await openDB();

  async function hashText(text){
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hex = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
    return hex;
  }

  // LOGIN page
  if(document.body.classList.contains('page-login')){
     
    // --- INICIO NUEVA CONDICIÓN ---
    // Si el usuario YA está logueado, redirige a la app principal
    const loggedInUser = JSON.parse(localStorage.getItem('ctrl_user') || 'null');
    if(loggedInUser){
      location.href = 'main.html';
      return; // Detener ejecución de la página de login
    }
    // --- FIN NUEVA CONDICIÓN ---

    // --- INICIO MODIFICACIÓN ANIMACIÓN ---
    // El .container (main) obtendrá la clase .active
    const container = document.querySelector('main.container'); 
    const showRegister = document.getElementById('showRegister'); // Link a registro
    const showLogin = document.getElementById('showLogin');     // Link a login
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    // Esta es la lógica JS que solicitaste
    if (showRegister && showLogin && container) {
      showRegister.onclick = () => { container.classList.add('active'); };
      showLogin.onclick = () => { container.classList.remove('active'); };
    } else {
      console.error('No se encontraron los elementos para la animación de login.');
    }
    // --- FIN MODIFICACIÓN ANIMACIÓN ---

    // --- INICIO LÓGICA MODAL DE PRIVACIDAD ---
    const openPrivacyLink = document.getElementById('openPrivacyLink');
    const privacyModal = document.getElementById('privacyModal');
    const closePrivacyBtn = document.getElementById('closePrivacyBtn');

    if (openPrivacyLink && privacyModal && closePrivacyBtn) {
      openPrivacyLink.onclick = (e) => {
        e.preventDefault(); // Evitar que el link '#' mueva la página
        privacyModal.classList.remove('hidden');
      };
      closePrivacyBtn.onclick = () => {
        privacyModal.classList.add('hidden');
      };
      // Opcional: cerrar si se hace clic fuera del modal-content
      privacyModal.addEventListener('click', (e) => {
        if (e.target === privacyModal) {
          privacyModal.classList.add('hidden');
        }
      });
    }
    // --- FIN LÓGICA MODAL ---


    registerForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const nombre = document.getElementById('regNombre').value.trim();
      const pass = document.getElementById('regPass').value;
      const pass2 = document.getElementById('regPass2').value;
      if(pass !== pass2){ alert('Las contraseñas no coinciden'); return; } // Se mantiene alert simple en login
      const usuario = nombre.split(' ')[0].toLowerCase();
      const hashed = await hashText(pass);
      try{
        const id = await addItem('users', {usuario, nombre, password:hashed, rol:'guardia', created:Date.now()});
        localStorage.setItem('ctrl_user', JSON.stringify({id,usuario,nombre}));
        location.href = 'main.html';
      }catch(err){
        alert('Error: probablemente el usuario ya existe.');
        console.error(err);
      }
    });

    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const usuario = document.getElementById('loginUsuario').value.trim();
      const pass = document.getElementById('loginPass').value;
      const hashed = await hashText(pass);
      const users = await getAll('users');
      const user = users.find(u=>u.usuario===usuario || u.nombre===usuario);
      if(!user){ alert('Usuario no encontrado. Regístrate'); return; }
      if(user.password !== hashed){ alert('Contraseña incorrecta'); return; }
      localStorage.setItem('ctrl_user', JSON.stringify({id:user.id,usuario:user.usuario,nombre:user.nombre}));
      location.href = 'main.html';
    });

    const existing = await getAll('users');
    if(existing.length===0){
      const demoHash = await hashText('guard123');
      try{ await addItem('users',{usuario:'guardia',nombre:'Guardia Demo',password:demoHash,rol:'guardia',created:Date.now()}); }catch(e){}
    }
  }

  // MAIN SPA
  if(document.body.classList.contains('page-main')){
    const user = JSON.parse(localStorage.getItem('ctrl_user') || 'null');
    
    // --- CONDICIÓN REQUERIDA (YA EXISTÍA) ---
    // Si NO hay usuario, redirige a index.html
    if(!user){ 
      location.href='index.html'; 
      return; // Detiene la ejecución del resto del script de main.html
    }
    // --- FIN CONDICIÓN ---

    document.getElementById('saludo').textContent = `Buen turno ${user.nombre}`;

    // --- CAMBIO: Redirige a index.html en lugar de login.html ---
    document.getElementById('logoutBtn').onclick = ()=>{ localStorage.removeItem('ctrl_user'); location.href='index.html'; };

    // --- INICIO MODIFICACIÓN ANIMACIÓN Y RECARGA DE DATOS ---
    const mainContainer = document.getElementById('app-main-container'); // Get the main container

    // navigation
    const navBtns = document.querySelectorAll('.nav-btn');
    
    // Convertir a async para poder usar await
    async function showScreen(id){ 
      // --- Lógica de animación ---
      // 1. Quitar clases de posición anteriores
      mainContainer.classList.remove('show-paqueteria', 'show-directorio', 'show-historial');
      
      // 2. Añadir la nueva clase de posición Y RECARGAR DATOS
      if (id === 'screen-paqueteria') {
        mainContainer.classList.add('show-paqueteria');
        // Opcional: recargar autocompletar si es necesario
        // await rebuildAutocomplete(); 
      } else if (id === 'screen-directorio') {
        mainContainer.classList.add('show-directorio');
        await refreshDomicilios(); // <-- CORRECCIÓN: Recargar al ver
      } else if (id === 'screen-historial') {
        mainContainer.classList.add('show-historial');
        await refreshPaquetes(); // <-- CORRECCIÓN: Recargar al ver
      }
      
      // --- Lógica de botones (sin cambios) ---
      navBtns.forEach(b=>b.classList.remove('active'));
      document.querySelector(`.nav-btn[data-screen="${id}"]`).classList.add('active');
    }
    
    // Añadir async/await al listener
    navBtns.forEach(btn=>btn.addEventListener('click', async () => await showScreen(btn.dataset.screen)));
    // --- FIN MODIFICACIÓN ANIMACIÓN Y RECARGA DE DATOS ---


    // elements
    const guiaEl = document.getElementById('guia');
    const guiaSuggestions = document.getElementById('guiaSuggestions');
    const nombreDest = document.getElementById('nombreDest');
    const nombresList = document.getElementById('nombresList');
    const paqueteriaInput = document.getElementById('paqueteriaInput');
    const paqList = document.getElementById('paqList');
    const domicilioInput = document.getElementById('domicilioInput');
    const domList = document.getElementById('domList');
    const fotoInput = document.getElementById('fotoInput');
    const fotoPreview = document.getElementById('fotoPreview');
    const recibirBtn = document.getElementById('recibirBtn');
    const entregarBtn = document.getElementById('entregarBtn');
    const statusMsg = document.getElementById('statusMsg'); // Ahora es un DIV

    const fotoBtn = document.getElementById('fotoBtn');
    const idFotoBtn = document.getElementById('idFotoBtn');

    const tablaPaquetes = document.getElementById('tablaPaquetes');
    const tablaDomicilios = document.getElementById('tablaDomicilios');

    // Directorio
    const domForm = document.getElementById('domForm');
    const addResident = document.getElementById('addResident');
    const moreResidents = document.getElementById('moreResidents');

    // Historial filters
    const buscarHist = document.getElementById('buscarHist');
    const filtroEstado = document.getElementById('filtroEstado');
    const fechaDesde = document.getElementById('fechaDesde');
    const fechaHasta = document.getElementById('fechaHasta');
    const fechaDesdeLabel = document.getElementById('fechaDesdeLabel');
    const fechaHastaLabel = document.getElementById('fechaHastaLabel');

    // signature modal and viewer
    const firmaModal = document.getElementById('firmaModal');
    const firmaCanvas = document.getElementById('firmaCanvas');
    const limpiarFirma = document.getElementById('limpiarFirma');
    const guardarFirma = document.getElementById('guardarFirma');
    const cerrarFirma = document.getElementById('cerrarFirma');
    const idFotoInput = document.getElementById('idFotoInput');
    const idPreview = document.getElementById('idPreview');

    // Modal Confirmación (ÚNICA)
    const confirmEntregarModal = document.getElementById('confirmEntregarModal');
    const confirmEntregarMsg = document.getElementById('confirmEntregarMsg');
    const cancelEntregarBtn = document.getElementById('cancelEntregarBtn');
    const confirmEntregarBtn = document.getElementById('confirmEntregarBtn');

    // Modal Confirmación (VARIOS)
    const entregarVariosBtn = document.getElementById('entregarVariosBtn'); // Sigue declarado
    const confirmEntregarVariosModal = document.getElementById('confirmEntregarVariosModal');
    const domicilioVariosTxt = document.getElementById('domicilioVariosTxt');
    const listaPaquetesVarios = document.getElementById('listaPaquetesVarios');
    const cancelVariosBtn = document.getElementById('cancelVariosBtn');
    const confirmVariosBtn = document.getElementById('confirmVariosBtn');

    let currentBatchToDeliver = []; 
    let domicilioDebounceTimer; // Timer para el pop-up automático

    const imageViewer = document.getElementById('imageViewer');
    const viewerImg = document.getElementById('viewerImg');
    const viewerMeta = document.getElementById('viewerMeta');
    const prevImg = document.getElementById('prevImg');
    const nextImg = document.getElementById('nextImg');
    const closeImageViewer = document.getElementById('closeImageViewer');

    let messageTimer;
    function showMessage(message, type = 'success') {
      if (messageTimer) clearTimeout(messageTimer);
      statusMsg.textContent = message;
      statusMsg.className = `show ${type}`;
      messageTimer = setTimeout(() => {
        statusMsg.className = '';
      }, 5000); // Un poco más de tiempo para leer mensajes largos
    }
    function clearMessage() {
      if (messageTimer) clearTimeout(messageTimer);
      statusMsg.textContent = '';
      statusMsg.className = '';
    }

    // Canvas setup
    const ctx = firmaCanvas.getContext('2d');
    function setupCanvas(){
      const rectMaxWidth = Math.min(window.innerWidth - 80, 520);
      const displayW = rectMaxWidth;
      const displayH = 200;
      const ratio = window.devicePixelRatio || 1;
      firmaCanvas.style.width = displayW + 'px';
      firmaCanvas.style.height = displayH + 'px';
      firmaCanvas.width = Math.floor(displayW * ratio);
      firmaCanvas.height = Math.floor(displayH * ratio);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      clearCanvas();
    }
    
    let hasSigned = false;

    function clearCanvas(){
      ctx.clearRect(0,0,firmaCanvas.width, firmaCanvas.height);
      ctx.save();
      ctx.strokeStyle = '#cfe6ff';
      ctx.setLineDash([6,6]);
      const w = (firmaCanvas.width/(window.devicePixelRatio||1)) -12;
      const h = (firmaCanvas.height/(window.devicePixelRatio||1)) -12;
      ctx.strokeRect(6,6, w, h);
      ctx.restore();
      hasSigned = false; // Resetear flag al limpiar
    }
    setupCanvas();
    window.addEventListener('resize', ()=>{ setupCanvas(); });

    // drawing
    let drawing=false;
    function getPos(e){
      const r = firmaCanvas.getBoundingClientRect();
      let clientX, clientY;
      if(e.touches && e.touches[0]){ clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      else { clientX = e.clientX; clientY = e.clientY; }
      return { x: clientX - r.left, y: clientY - r.top };
    }
    function pointerDown(e){
      e.preventDefault();
      drawing = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
    function pointerMove(e){
      if(!drawing) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = '#05304b';
      ctx.stroke();
      hasSigned = true; // Marcar que se ha firmado
    }
    function pointerUp(e){
      drawing = false;
    }
    firmaCanvas.addEventListener('touchstart', pointerDown, {passive:false});
    firmaCanvas.addEventListener('touchmove', pointerMove, {passive:false});
    firmaCanvas.addEventListener('touchend', pointerUp);
    firmaCanvas.addEventListener('mousedown', pointerDown);
    window.addEventListener('mousemove', pointerMove);
    window.addEventListener('mouseup', pointerUp);
    limpiarFirma.addEventListener('click', ()=>{ clearCanvas(); });

    fotoBtn.addEventListener('click', () => {
      fotoInput.click();
    });
    idFotoBtn.addEventListener('click', () => {
      idFotoInput.click();
    });

    // preview photos
    fotoInput.addEventListener('change', async (e)=>{
      const f = e.target.files[0];
      if(!f) { fotoPreview.innerHTML=''; return; }
      const url = await fileToDataURL(f);
      fotoPreview.innerHTML = `<img alt="foto paquete" src="${url}">`;
    });
    idFotoInput.addEventListener('change', async (e)=>{
      const f = e.target.files[0];
      if(!f) { idPreview.innerHTML=''; return; }
      const url = await fileToDataURL(f);
      idPreview.innerHTML = `<img alt="foto id" src="${url}">`;
    });

    async function fileToDataURL(file){
      if(!file) return null;
      return new Promise((res,rej)=>{
        const r = new FileReader();
        r.onload = ()=>res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
    }

    // refresh helpers
    async function rebuildAutocomplete(){
      const paqs = await getAll('paquetes');
      const doms = await getAll('domicilios');
      const nombres = new Set();
      const paqsTxt = new Set();
      
      doms.forEach(d=>{ 
        if(d.residentes) d.residentes.forEach(r=>nombres.add(r)); 
      });

      paqs.forEach(p=>{ 
        if(p.nombre) nombres.add(p.nombre); 
        if(p.paqueteria) paqsTxt.add(p.paqueteria);
      });

      nombresList.innerHTML=''; paqList.innerHTML=''; domList.innerHTML='';
      nombres.forEach(n=>{ const o=document.createElement('option'); o.value=n; nombresList.appendChild(o); });
      paqsTxt.forEach(n=>{ const o=document.createElement('option'); o.value=n; paqList.appendChild(o); });
      doms.forEach(d=>{ const o=document.createElement('option'); o.value=d.calle; domList.appendChild(o); }); 
    }

    // INICIO MODIFICACIÓN: Mostrar teléfono en tabla de domicilios
    async function refreshDomicilios(){
      const doms = await getAll('domicilios');
      tablaDomicilios.innerHTML='';
      doms.forEach(d=>{
        const row = document.createElement('div'); row.className='row';
        row.innerHTML = `<div class="info">
                          <strong>${d.calle}</strong>
                          <div class="muted">${(d.residentes||[]).join(', ')}</div>
                          <div class="telefono"><span class="muted">Tel:</span> ${d.telefono || 'No registrado'}</div>
                         </div>
                         <div><button class="btn ghost" data-id="${d.id}" data-act="edit">Editar</button></div>`;
        tablaDomicilios.appendChild(row);
      });
    }
    // FIN MODIFICACIÓN

    // build history table with thumbnails and columns
    async function refreshPaquetes(){
      const paqs = await getAll('paquetes');
      tablaPaquetes.innerHTML = '';
      const filter = buscarHist.value.toLowerCase();
      const estadoF = filtroEstado.value;
      
      const desde = fechaDesde.valueAsDate; 
      const hasta = fechaHasta.valueAsDate;

      const rows = paqs.filter(p=>{
        if(filter){
          const found = (p.guia||'').toLowerCase().includes(filter) || 
                        (p.nombre||'').toLowerCase().includes(filter) || 
                        (p.estado||'').toLowerCase().includes(filter) || 
                        (p.domicilio||'').toLowerCase().includes(filter); 
          if(!found) return false;
        }
        if(estadoF && p.estado !== estadoF) return false;
        
        const fechaPaquete = new Date(p.created);
        if(desde && fechaPaquete < desde) return false;
        if(hasta) {
            const hastaMañana = new Date(hasta);
            hastaMañana.setDate(hastaMañana.getDate() + 1);
            if (fechaPaquete >= hastaMañana) return false;
        }
        return true;
      }).sort((a,b)=>b.created - a.created);

      rows.forEach(p=>{
        const row = document.createElement('div'); 
        row.className='row'; 
        if(p.estado === 'en_caseta') { 
          row.classList.add('estado-en_caseta'); 
        } else if (p.estado === 'entregado') {
          row.classList.add('estado-entregado');
        }
        
        const info = document.createElement('div'); info.className='info';
        
        info.innerHTML = `
          <strong>${p.domicilio || 'Sin domicilio'}</strong>
          <div>Guía: ${p.guia || '—'}</div>
          <div>Residente: ${p.nombre}</div>
          <div class="muted">Recibió: ${p.recibidoPor || '-'}</div>
          <div class="muted">Entregó: ${p.entregadoPor || '-'}</div>
          <div class="muted">Recibido: ${formatDate(p.created)}</div>
          ${p.entregadoEn ? `<div class="muted">Entregado: ${formatDate(p.entregadoEn)}</div>` : ''}
          <div class="muted">Estado: ${p.estado || ''}</div>
        `;
        
        const thumbs = document.createElement('div');
        thumbs.style.display='flex'; 
        thumbs.style.alignItems='center';
        thumbs.style.flexWrap = 'wrap'; 
        thumbs.style.gap = '8px'; 

        if(p.foto){
          const img = document.createElement('img'); img.src = p.foto; img.className='thumb'; img.dataset.paqueteId = p.id; img.dataset.type='foto';
          img.addEventListener('click', ()=> openViewerFor(p, 'foto'));
          thumbs.appendChild(img);
        } else {
          const placeholder = document.createElement('div'); 
          placeholder.style.width='120px'; 
          placeholder.style.height='120px'; 
          placeholder.style.background='#f1f5f9'; 
          placeholder.style.borderRadius='8px'; 
          placeholder.style.display='flex'; 
          placeholder.style.alignItems='center'; 
          placeholder.style.justifyContent='center'; 
          placeholder.textContent='No foto';
          placeholder.className = 'thumb';
          thumbs.appendChild(placeholder);
        }

        if(p.idFoto){
          const img2 = document.createElement('img'); img2.src = p.idFoto; img2.className='thumb'; img2.dataset.paqueteId = p.id; img2.dataset.type='id';
          img2.addEventListener('click', ()=> openViewerFor(p, 'id'));
          thumbs.appendChild(img2);
        }

        if(p.firma){
          const img3 = document.createElement('img'); img3.src = p.firma; img3.className='thumb thumb-firma';
          img3.dataset.paqueteId = p.id; img3.dataset.type='firma';
          img3.addEventListener('click', ()=> openViewerFor(p, 'firma'));
          thumbs.appendChild(img3);
        }
        
        const actions = document.createElement('div');
        actions.innerHTML = `<button class="btn ghost" data-id="${p.id}" data-act="view">Ver</button>`;

        row.appendChild(info); row.appendChild(thumbs); row.appendChild(actions);
        tablaPaquetes.appendChild(row);
      });
    }

    function formatDate(ts){
      if(!ts) return '-';
      const d = new Date(ts);
      return d.toLocaleString(); // Formato: DD/MM/AAAA, HH:MM:SS
    }
    
    function formatLabelDate(dateString) {
      if (!dateString) return null;
      try {
        const parts = dateString.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10); // 1-12
        const day = parseInt(parts[2], 10); // 1-31
        
        const shortYear = year.toString().slice(-2);
        return `${day}/${month}/${shortYear}`;
      } catch (e) {
        return dateString; // Fallback
      }
    }


    await rebuildAutocomplete(); await refreshDomicilios(); await refreshPaquetes();

    // SUGERENCIAS DE GUÍA (solo en caseta)
    guiaEl.addEventListener('input', async ()=>{
      clearMessage(); // Limpiar mensajes al escribir
      const q = guiaEl.value.trim().toLowerCase();
      guiaSuggestions.innerHTML = '';
      if(!q) return;
      const paqs = await getAll('paquetes');
      
      const matches = paqs.filter(p => 
        p.estado === 'en_caseta' && 
        ((p.guia||'').toLowerCase().includes(q) || (p.nombre||'').toLowerCase().includes(q))
      );

      if(matches.length){
        const ul = document.createElement('ul');
        matches.slice(0,8).forEach(m=>{
          const li = document.createElement('li');
          li.textContent = `${m.guia} · ${m.nombre} · ${m.paqueteria||''}`;
          li.addEventListener('click', async ()=>{
            guiaEl.value = m.guia;
            nombreDest.value = m.nombre || '';
            paqueteriaInput.value = m.paqueteria || '';
            domicilioInput.value = m.domicilio || '';
            guiaSuggestions.innerHTML = '';
            
            if (m.foto) {
              fotoPreview.innerHTML = `<img alt="foto paquete existente" src="${m.foto}">`;
            } else {
              fotoPreview.innerHTML = '';
            }
            fotoInput.value = ''; 
          });
          ul.appendChild(li);
        });
        guiaSuggestions.appendChild(ul);
      }
    });

    // Mostrar pop-up de entrega múltiple automáticamente
    domicilioInput.addEventListener('input', async () => {
      clearTimeout(domicilioDebounceTimer); 
      const dom = domicilioInput.value.trim();
      
      if (!dom) {
        return; 
      }

      domicilioDebounceTimer = setTimeout(async () => {
        if (!confirmEntregarModal.classList.contains('hidden') || 
            !confirmEntregarVariosModal.classList.contains('hidden') || 
            !firmaModal.classList.contains('hidden')) {
          return;
        }
        if (guiaEl.value.trim().length > 0) {
            return;
        }

        const paqs = await getAll('paquetes');
        const paquetesParaEntregar = paqs.filter(p => p.domicilio === dom && p.estado === 'en_caseta');

        if (paquetesParaEntregar.length > 0) {
          currentBatchToDeliver = paquetesParaEntregar;
          domicilioVariosTxt.textContent = dom;
          listaPaquetesVarios.innerHTML = '<ul>' + 
            paquetesParaEntregar.map(p => {
              const fotoMiniatura = p.foto ? `<img src="${p.foto}" class="thumb-miniatura" data-paquete-id="${p.id}" data-type="foto" alt="foto paquete">` : '';
              return `
                <li style="display: flex; align-items: center; gap: 8px;">
                  ${fotoMiniatura}
                  <div>
                    <strong>${p.guia}</strong> - ${p.nombre}
                    <div class="info-paquete">
                      ${p.paqueteria || 'Sin paquetería'} | Recibido: ${formatDate(p.created)}
                    </div>
                  </div>
                </li>`;
            }).join('') +
            '</ul>';
          
          confirmEntregarVariosModal.classList.remove('hidden');
        }
      }, 1000); 
    });

    listaPaquetesVarios.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('thumb-miniatura')) {
        const paqueteId = Number(target.dataset.paqueteId);
        const tipoFoto = target.dataset.type;
        const paquete = currentBatchToDeliver.find(p => p.id === paqueteId);
        if (paquete) {
          openViewerFor(paquete, tipoFoto);
        }
      }
    });


    // receive package: save recibidoPor
    recibirBtn.addEventListener('click', async ()=>{
      clearMessage();
      const guia = guiaEl.value.trim();
      const nombre = nombreDest.value.trim();
      const fotoActual = fotoInput.files[0]; 
      const fotoExistente = fotoPreview.querySelector('img') ? fotoPreview.querySelector('img').src : null; 

      if(!guia || !nombre){ 
        showMessage('❌ Guía y nombre son obligatorios', 'error');
        return; 
      }
      
      if (!fotoActual && !fotoExistente) {
          showMessage('❌ Es obligatorio 📸 Tomar foto del paquete', 'error');
          return;
      }

      const paqs = await getAll('paquetes');
      const p = paqs.find(x => x.guia === guia);
      if (p && p.estado === 'entregado') {
        showMessage('❌ Ese paquete ya fue entregado', 'error');
        return;
      }

      const fotoDataURL = fotoActual ? await fileToDataURL(fotoActual) : fotoExistente;

      const paquete = {
          guia, 
          nombre, 
          paqueteria:paqueteriaInput.value, 
          domicilio:domicilioInput.value, 
          foto: fotoDataURL, 
          estado:'en_caseta', 
          created: Date.now(), 
          recibidoPor: user.nombre
      };
      
      try{
        const id = p ? await putItem('paquetes', {...paquete, id: p.id}) : await addItem('paquetes', paquete);
        if (!p) {
          await addItem('historial',{paqueteId:id,estado:'en_caseta',usuario:user.nombre,fecha:Date.now(),nota:''});
        }
        
        // --- INICIO NOTIFICACIÓN WHATSAPP (RECIBIDO) ---
        const dom = domicilioInput.value.trim();
        let notified = false;
        if (dom) {
          const doms = await getAll('domicilios');
          const domInfo = doms.find(d => d.calle === dom);
          if (domInfo && domInfo.telefono) {
            const nombreRes = nombreDest.value.trim() || `residente del ${dom}`;
            const paqInfo = `Paquete: ${paqueteriaInput.value || 'N/A'}\nGuía: ${guia}`;
            // \n es un salto de línea en WhatsApp
            const msg = `Hola ${nombreRes}, se ha recibido 1 paquete para su domicilio.\n${paqInfo}\nRecibido por: ${user.nombre}.`;
            const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank'); // Abre en una nueva pestaña
            notified = true;
          }
        }
        
        if(notified) {
          showMessage(p ? 'Paquete actualizado (Abriendo WA...)' : 'Paquete registrado (Abriendo WA...)', 'success');
        } else {
          showMessage(p ? 'Paquete actualizado (Sin notif. WA)' : 'Paquete registrado (Sin notif. WA)', 'success');
        }
        // --- FIN NOTIFICACIÓN ---

        guiaEl.value=''; nombreDest.value=''; paqueteriaInput.value=''; domicilioInput.value=''; fotoInput.value='';
        fotoPreview.innerHTML = '';
        await refreshPaquetes(); await rebuildAutocomplete();
      }catch(err){
        const errorMsg = (err.name === 'ConstraintError' || (err.message && err.message.includes('key'))) ? 'Error: Guía duplicada.' : 'Error al guardar.';
        showMessage(`❌ ${errorMsg}`, 'error');
        console.error(err);
      }
    });

    // --- FLUJO DE ENTREGA (ÚNICA) ---
    entregarBtn.addEventListener('click', async ()=>{
      clearMessage();
      currentBatchToDeliver = []; 
      const guia = guiaEl.value.trim();
      if(!guia){ 
        showMessage('❌ Escribe la guía del paquete a entregar', 'error');
        return; 
      }
      const paqs = await getAll('paquetes');
      const p = paqs.find(x=>x.guia===guia);
      
      if(!p){ 
        showMessage('❌ Paquete no encontrado', 'error');
        return; 
      }
      if (p.estado === 'entregado') {
        showMessage('❌ Ese paquete ya fue entregado', 'error');
        return;
      }

      confirmEntregarMsg.textContent = `¿Estás seguro de entregar el paquete ${p.guia} a ${p.nombre}?`;
      confirmEntregarModal.classList.remove('hidden');
    });

    cancelEntregarBtn.addEventListener('click', () => {
      confirmEntregarModal.classList.add('hidden');
    });

    confirmEntregarBtn.addEventListener('click', () => {
      confirmEntregarModal.classList.add('hidden');
      firmaModal.classList.remove('hidden');
      idPreview.innerHTML = '';
      idFotoInput.value = '';
      clearCanvas(); // Limpia el canvas y resetea hasSigned
    });

    // --- FLUJO DE ENTREGA (VARIOS) ---
    cancelVariosBtn.addEventListener('click', () => {
      confirmEntregarVariosModal.classList.add('hidden');
      currentBatchToDeliver = []; 
    });

    confirmVariosBtn.addEventListener('click', () => {
      confirmEntregarVariosModal.classList.add('hidden');
      firmaModal.classList.remove('hidden');
      idPreview.innerHTML = '';
      idFotoInput.value = '';
      clearCanvas(); // Limpia el canvas y resetea hasSigned
    });
    // --- FIN FLUJO (VARIOS) ---


    // --- MODAL DE FIRMA (UNIFICADO) ---
    cerrarFirma.addEventListener('click', () => {
        firmaModal.classList.add('hidden');
        currentBatchToDeliver = []; 
    });

    guardarFirma.addEventListener('click', async ()=>{
      
      const idFotoFile = idFotoInput.files[0];
      const idFotoPreviewSrc = idPreview.querySelector('img') ? idPreview.querySelector('img').src : null;

      if (!idFotoFile && !idFotoPreviewSrc) { 
        showMessage('❌ Es obligatorio 🆔 Tomar foto de ID', 'error');
        return;
      }

      if (!hasSigned) { 
          showMessage('❌ Es obligatorio ✍️ Firmar en el recuadro.', 'error');
          return;
      }

      const dataURL = firmaCanvas.toDataURL('image/png');
      const idFoto = idFotoFile ? await fileToDataURL(idFotoFile) : idFotoPreviewSrc;
      const entregadoPor = user.nombre;
      const entregadoEn = Date.now();
      let notified = false; // Flag de notificación

      // --- INICIO RAMA: ENTREGA DE LOTE ---
      if (currentBatchToDeliver.length > 0) {
        const dom = currentBatchToDeliver[0].domicilio;
        try {
          for (const p of currentBatchToDeliver) {
            p.estado = 'entregado';
            p.firma = dataURL;
            p.idFoto = idFoto;
            p.entregadoPor = entregadoPor;
            p.entregadoEn = entregadoEn;
            await putItem('paquetes', p);
            await addItem('historial',{paqueteId:p.id,estado:'entregado',usuario:entregadoPor,fecha:entregadoEn,nota:'Entrega en lote'});
          }
          
          // Notificar WA para lote
          if (dom) {
            const doms = await getAll('domicilios');
            const domInfo = doms.find(d => d.calle === dom);
            if (domInfo && domInfo.telefono) {
              const msg = `Hola residente del ${dom}, se han entregado ${currentBatchToDeliver.length} paquetes en su domicilio.\nEntregado por: ${user.nombre}.`;
              const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`;
              window.open(url, '_blank');
              notified = true;
            }
          }
          
          showMessage(notified ? `Se entregaron ${currentBatchToDeliver.length} paquetes (Abriendo WA...)` : `Se entregaron ${currentBatchToDeliver.length} paquetes (Sin notif. WA)`, 'success');
          
        } catch (err) {
          showMessage('❌ Error al guardar entrega múltiple.', 'error');
          console.error(err);
        }
        
        currentBatchToDeliver = []; 
      
      // --- INICIO RAMA: ENTREGA ÚNICA ---
      } else {
        const guia = guiaEl.value.trim(); 
        const paqs = await getAll('paquetes');
        const p = paqs.find(x=>x.guia===guia);

        if(!p){ 
          firmaModal.classList.add('hidden');
          showMessage('❌ Paquete no encontrado', 'error'); 
          return; 
        }
        if (p.estado === 'entregado') {
          firmaModal.classList.add('hidden');
          showMessage('❌ Ese paquete ya fue entregado', 'error');
          return;
        }

        p.estado = 'entregado';
        p.firma = dataURL;
        p.idFoto = idFoto;
        p.entregadoPor = entregadoPor;
        p.entregadoEn = entregadoEn;
        await putItem('paquetes', p);
        await addItem('historial',{paqueteId:p.id,estado:'entregado',usuario:entregadoPor,fecha:entregadoEn,nota:''});
        
        // Notificar WA para entrega única
        const dom = p.domicilio;
        if (dom) {
            const doms = await getAll('domicilios');
            const domInfo = doms.find(d => d.calle === dom);
            if (domInfo && domInfo.telefono) {
              const msg = `Hola ${p.nombre}, se ha entregado su paquete (Guía: ${p.guia}).\nEntregado por: ${user.nombre}.`;
              const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`;
              window.open(url, '_blank');
              notified = true;
            }
        }
        
        showMessage(notified ? 'Paquete entregado (Abriendo WA...)' : 'Paquete entregado (Sin notif. WA)', 'success');
      }
      // --- FIN RAMAS ---

      // Limpieza común
      firmaModal.classList.add('hidden');
      guiaEl.value=''; nombreDest.value=''; paqueteriaInput.value=''; domicilioInput.value=''; fotoInput.value='';
      fotoPreview.innerHTML = '';
      idPreview.innerHTML = '';
      idFotoInput.value = '';
      hasSigned = false;
      entregarVariosBtn.disabled = true; 
      entregarVariosBtn.textContent = 'Entregar (Varios)';
      await refreshPaquetes();
    });


    // --- INICIO MODIFICACIÓN: Guardar teléfono en directorio ---
    domForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      clearMessage();
      const calle = document.getElementById('domCalle').value.trim();
      const res1 = document.getElementById('domResidente1').value.trim();
      const nota = document.getElementById('domNota').value.trim();
      const telefono = document.getElementById('domTelefono').value.trim();

      // Limpiar teléfono (quitar +, espacios, guiones)
      const cleanPhone = telefono.replace(/[^0-9]/g, ''); 

      if(telefono && (!cleanPhone || cleanPhone.length < 10)) {
         showMessage('❌ Teléfono inválido. Use solo números e incluya código de país (ej. 521...).', 'error');
         return;
      }
      
      const otros = Array.from(document.querySelectorAll('.residenteField')).map(i=>i.value.trim()).filter(Boolean);
      const residentes = [res1, ...otros];
      
      try{
        const id = await addItem('domicilios',{calle, residentes, nota, telefono: cleanPhone, created:Date.now()});
        showMessage('Domicilio guardado', 'success');
        domForm.reset(); moreResidents.innerHTML='';
        await refreshDomicilios(); await rebuildAutocomplete();
      }catch(err){ 
        showMessage('❌ Error al guardar domicilio', 'error');
        console.error(err); 
      }
    });
    // --- FIN MODIFICACIÓN ---


    // table actions
    tablaDomicilios.addEventListener('click', async (e)=>{
      const act = e.target.dataset.act;
      const id = Number(e.target.dataset.id);
      if(act==='edit'){
        const d = await getByKey('domicilios', id);
        if(!d) return;
        document.getElementById('domCalle').value = d.calle;
        document.getElementById('domResidente1').value = (d.residentes && d.residentes[0]) || '';
        document.getElementById('domNota').value = d.nota || '';
        // Cargar teléfono para editar
        document.getElementById('domTelefono').value = d.telefono || '';
        showMessage('Datos cargados para editar. Guarda una nueva entrada con los cambios.', 'success');
      }
    });

    tablaPaquetes.addEventListener('click', async (e)=>{
      const act = e.target.dataset.act;
      const id = Number(e.target.dataset.id);
      if(act==='delete'){
        console.warn('La acción de eliminar fue deshabilitada.');
      }
      if(act==='view'){
        const p = await getByKey('paquetes', id);
        const win = window.open('');
        win.document.write(`<h3>Guía: ${p.guia}</h3><p>Nombre: ${p.nombre}</p><p>Estado: ${p.estado}</p><p>Paquetería: ${p.paqueteria}</p>
          <p>Domicilio: ${p.domicilio}</p>
          <p>Recibido por: ${p.recibidoPor||'-'}</p>
          <p>Entregado por: ${p.entregadoPor||'-'}</p>
          <p>${p.foto?'<img style="max-width:100%" src="'+p.foto+'"/>':''}</p>
          <p>${p.idFoto?'<img style="max-width:100%" src="'+p.idFoto+'"/>':''}</p>
          ${p.firma?'<h4>Firma</h4><img style="max-width:100%" src="'+p.firma+'"/>':''}
        `);
      }
    });

    // image viewer logic
    let currentGallery = []; // array of {src,meta}
    let currentIndex = 0;
    function openViewerFor(p, type){
      currentGallery = [];
      if(p.foto) currentGallery.push({src:p.foto, meta:`Foto paquete — ${p.guia}`});
      if(p.idFoto) currentGallery.push({src:p.idFoto, meta:`ID — ${p.guia}`});
      if(p.firma) currentGallery.push({src:p.firma, meta:`Firma — ${p.guia}`});
      if(currentGallery.length===0) return;
      
      let desiredIndex = 0;
      if (type === 'id' && p.idFoto) {
        desiredIndex = currentGallery.findIndex(x => x.meta.startsWith('ID'));
      } else if (type === 'firma' && p.firma) {
        desiredIndex = currentGallery.findIndex(x => x.meta.startsWith('Firma'));
      }
      currentIndex = desiredIndex >= 0 ? desiredIndex : 0;
      
      showGalleryImage();
      imageViewer.classList.remove('hidden');
    }
    function showGalleryImage(){
      const item = currentGallery[currentIndex];
      if(!item) return;
      viewerImg.src = item.src;
      viewerMeta.textContent = item.meta;
    }
    prevImg.addEventListener('click', ()=>{
      if(currentGallery.length===0) return;
      currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
      showGalleryImage();
    });
    nextImg.addEventListener('click', ()=>{
      if(currentGallery.length===0) return;
      currentIndex = (currentIndex + 1) % currentGallery.length;
      showGalleryImage();
    });
    closeImageViewer.addEventListener('click', ()=>{ imageViewer.classList.add('hidden'); viewerImg.src=''; });

    // filters
    buscarHist.addEventListener('input', refreshPaquetes);
    filtroEstado.addEventListener('change', refreshPaquetes);

    fechaDesde.addEventListener('change', (e) => {
      const formatted = formatLabelDate(e.target.value);
      const labelElement = e.target.parentElement; // El <label>
      
      if (formatted) {
        fechaDesdeLabel.textContent = formatted;
        labelElement.classList.add('has-value');
      } else {
        fechaDesdeLabel.textContent = '🗓️ Desde';
        labelElement.classList.remove('has-value');
      }
      refreshPaquetes(); // Mantener la funcionalidad de refrescar
    });
    
    fechaHasta.addEventListener('change', (e) => {
      const formatted = formatLabelDate(e.target.value);
      const labelElement = e.target.parentElement; // El <label>

      if (formatted) {
        fechaHastaLabel.textContent = formatted;
        labelElement.classList.add('has-value');
      } else {
        fechaHastaLabel.textContent = '🗓️ Hasta';
        labelElement.classList.remove('has-value');
      }
      refreshPaquetes(); // Mantener la funcionalidad de refrescar
    });
  }
})();


