// app.js
import { 
    collection, addDoc, query, where, onSnapshot, orderBy, 
    serverTimestamp, doc, deleteDoc, updateDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const elements = {
    app: document.getElementById('app-container'),
    auth: document.getElementById('auth-container'),
    transForm: document.getElementById('transaction-form'),
    history: document.getElementById('history-list'),
    incEl: document.getElementById('total-income'),
    expEl: document.getElementById('total-expense'),
    balEl: document.getElementById('total-balance'),
    user: document.getElementById('user-display'),
    themeBtn: document.getElementById('theme-toggle'),
    logoutBtn: document.getElementById('logout-btn'),
    toast: document.getElementById('toast'),
    catSelect: document.getElementById('category'),
    editCatSelect: document.getElementById('edit-category'),
    catList: document.getElementById('categories-list'),
    modalEdit: document.getElementById('modal-edit'),
    modalCats: document.getElementById('modal-categories'),
    dailySummary: document.getElementById('daily-summary'),
    hashDisplay: document.getElementById('hash-display'),
    monthFilter: document.getElementById('month-filter'),
    chartCanvas: document.getElementById('category-chart')
};

let listeners = { trans: null, cats: null };
let currentTransactions = []; 
let userCategoriesMap = {};
window.categoryChartInstance = null; // Variable global para el gráfico

// --- TOASTS ---
const showToast = (msg, type = 'success') => {
    let prefix = type === 'error' ? '[ERROR]' : type === 'info' ? '[INFO]' : '[OK]';
    elements.toast.innerText = `${prefix} ${msg}`;
    elements.toast.className = `toast show ${type}`;
    setTimeout(() => elements.toast.className = 'toast', 3500);
};

const generateFakeHash = () => {
    const chars = '0123456789ABCDEF';
    let hash = 'KEY: 0x';
    for(let i=0; i<32; i++) hash += chars[Math.floor(Math.random() * chars.length)];
    elements.hashDisplay.innerText = hash;
};
setInterval(generateFakeHash, 10000); 

// --- TEMA ---
const setupTheme = () => {
    const isLight = localStorage.getItem('vault-theme') === 'light';
    if (isLight) document.body.classList.add('light-theme');

    elements.themeBtn.addEventListener('click', () => {
        const light = document.body.classList.toggle('light-theme');
        localStorage.setItem('vault-theme', light ? 'light' : 'dark');
        showToast(light ? 'Modo Claro Activado' : 'Modo Oscuro Activado', 'info');
        // Redibujar gráfico si cambia el tema
        if(currentTransactions.length > 0) renderCategoryFlow();
    });
};

// --- AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        elements.auth.classList.add('hidden');
        elements.app.classList.remove('hidden');
        setTimeout(() => elements.app.style.opacity = "1", 50);
        elements.user.innerText = `[${user.email}]`;
        generateFakeHash();
        startSync(user.uid);
    } else {
        elements.auth.classList.remove('hidden');
        elements.app.classList.add('hidden');
        elements.app.style.opacity = "0";
        if (listeners.trans) listeners.trans();
        if (listeners.cats) listeners.cats();
    }
});

elements.logoutBtn.addEventListener('click', async () => {
    if (confirm('¿Deseas cerrar tu sesión de trabajo?')) {
        try { await signOut(auth); showToast('Sesión Cerrada', 'info'); }
        catch (e) { showToast('Error al cerrar sesión', 'error'); }
    }
});

// --- SINCRONIZACIÓN DE DATOS ---
const baseCategories = {
    honorarios: { name: 'Honorarios / Nómina' },
    equipamiento: { name: 'Equipamiento' },
    software: { name: 'Servicios Digitales' },
    educacion: { name: 'Formación' },
    comida: { name: 'Alimentación' },
    transporte: { name: 'Logística / Movilidad' }
};

function startSync(uid) {
    listeners.cats = onSnapshot(query(collection(db, "categories"), where("userId", "==", uid)), (snap) => {
        let uCats = [];
        userCategoriesMap = { ...baseCategories }; 
        snap.forEach(d => {
            const data = d.data();
            uCats.push({ id: d.id, ...data });
            userCategoriesMap[d.id] = { name: data.name };
        });
        renderCats(uCats);
    });

    const q = query(collection(db, "transactions"), where("userId", "==", uid), orderBy("date", "desc"));
    listeners.trans = onSnapshot(q, (snap) => processTransactions(snap), 
    (err) => onSnapshot(query(collection(db, "transactions"), where("userId", "==", uid)), (snap) => processTransactions(snap, true)));
}

function processTransactions(snap, sort = false) {
    let list = []; let inc = 0; let exp = 0;
    snap.forEach(d => {
        const t = { id: d.id, ...d.data() };
        list.push(t);
        if (t.type === 'income') inc += t.amount; else exp += t.amount;
    });
    if (sort) list.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    currentTransactions = list; 

    elements.incEl.innerText = `$${inc.toFixed(2)}`;
    elements.expEl.innerText = `$${exp.toFixed(2)}`;
    elements.balEl.innerText = `$${(inc - exp).toFixed(2)}`;

    renderTable(list);
    renderCategoryFlow();
    renderDailySummary(list);
}

// --- RENDERIZADO UI ---
function renderCats(uCats) {
    const defaultList = Object.keys(baseCategories).map(id => ({ id, name: baseCategories[id].name }));
    const all = [...defaultList, ...uCats];
    const options = all.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    elements.catSelect.innerHTML = options;
    elements.editCatSelect.innerHTML = options;

    elements.catList.innerHTML = uCats.map(c => `
        <div class="flex justify-between items-center bg-slate-800 p-2 rounded-md border border-slate-700">
            <span class="text-xs font-mono text-slate-300">${c.name}</span>
            <button onclick="window.deleteCategory('${c.id}')" class="text-slate-500 hover:text-red-400"><i class="fas fa-trash text-xs"></i></button>
        </div>
    `).join('');
}

function renderTable(list) {
    elements.history.innerHTML = list.map(t => {
        const catName = userCategoriesMap[t.category]?.name || t.category;
        const isInc = t.type === 'income';
        return `
            <tr class="group">
                <td class="py-3 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">${t.date}</td>
                <td class="py-3 px-4">
                    <div class="text-sm text-slate-200 font-mono">${t.description}</div>
                    <div class="tech-badge mt-1 text-slate-400">${catName}</div>
                </td>
                <td class="py-3 px-4 text-right font-mono text-sm ${isInc ? 'text-green-400' : 'text-slate-300'}">
                    ${isInc ? '+' : '-'}$${t.amount.toFixed(2)}
                </td>
                <td class="py-3 px-4 text-center w-16">
                    <div class="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="window.openEditModal('${t.id}')" class="text-slate-500 hover:text-blue-400" title="Editar"><i class="fas fa-edit text-xs"></i></button>
                        <button onclick="window.deleteTransaction('${t.id}')" class="text-slate-500 hover:text-red-400" title="Borrar"><i class="fas fa-trash text-xs"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// INTEGRACIÓN DE CHART.JS
function renderCategoryFlow() {
    const filterMonth = elements.monthFilter.value; 
    const isLight = document.body.classList.contains('light-theme');
    const textColor = isLight ? '#64748b' : '#94a3b8';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
    
    const filteredList = currentTransactions.filter(t => {
        if (!filterMonth) return true;
        return t.date.startsWith(filterMonth);
    });

    const catFlow = {};
    filteredList.forEach(t => { 
        if(!catFlow[t.category]) catFlow[t.category] = 0;
        if(t.type === 'income') catFlow[t.category] += t.amount;
        else catFlow[t.category] -= t.amount;
    });

    // Preparar datos para Chart.js
    const sortedKeys = Object.keys(catFlow).sort((a,b) => Math.abs(catFlow[b]) - Math.abs(catFlow[a])).slice(0, 6); // Top 6 para que se vea limpio
    const labels = [];
    const data = [];
    const bgColors = [];

    sortedKeys.forEach(id => {
        labels.push(userCategoriesMap[id]?.name || id);
        const val = catFlow[id];
        data.push(val);
        // Verde para positivo, Rojo para negativo
        bgColors.push(val >= 0 ? 'rgba(34, 197, 94, 0.85)' : 'rgba(239, 68, 68, 0.85)'); 
    });

    const ctx = elements.chartCanvas.getContext('2d');

    // Destruir gráfico anterior si existe
    if (window.categoryChartInstance) {
        window.categoryChartInstance.destroy();
    }

    if (sortedKeys.length === 0) {
        // Mostrar mensaje en el canvas si no hay datos
        ctx.clearRect(0, 0, elements.chartCanvas.width, elements.chartCanvas.height);
        ctx.font = "12px 'Fira Code', monospace";
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.fillText(`SIN DATOS EN ${filterMonth || 'EL PERIODO'}`, elements.chartCanvas.width/2, elements.chartCanvas.height/2);
        return;
    }

    // Crear nuevo gráfico
    window.categoryChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Balance Neto ($)',
                data: data,
                backgroundColor: bgColors,
                borderRadius: 4, // Bordes redondeados
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Fira Code', size: 11 },
                    bodyFont: { family: 'Fira Code', size: 13, weight: 'bold' },
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            let val = context.parsed.y;
                            return (val >= 0 ? '+' : '') + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Fira Code', size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        color: textColor, 
                        font: { family: 'Fira Code', size: 9 },
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

function renderDailySummary(list) {
    const dailyBalance = {};
    list.forEach(t => {
        if(!dailyBalance[t.date]) dailyBalance[t.date] = 0;
        if(t.type === 'income') dailyBalance[t.date] += t.amount;
        else dailyBalance[t.date] -= t.amount;
    });

    const dailySortedKeys = Object.keys(dailyBalance).sort((a,b) => new Date(b) - new Date(a)).slice(0, 6);

    if (dailySortedKeys.length === 0) {
        elements.dailySummary.innerHTML = '<p class="text-[10px] text-slate-600 font-mono text-center py-4">SIN DATOS</p>';
    } else {
        elements.dailySummary.innerHTML = dailySortedKeys.map(date => {
            const net = dailyBalance[date];
            const isPos = net >= 0;
            return `
                <div class="flex justify-between items-center py-2 border-b border-slate-800/50 last:border-0 group">
                    <span class="text-[10px] font-mono text-slate-400 group-hover:text-slate-200 transition-colors">
                        <i class="fas fa-caret-right mr-1 text-slate-600"></i> ${date}
                    </span>
                    <span class="text-[10px] font-mono font-bold ${isPos ? 'text-green-400' : 'text-red-400'}">
                        ${isPos ? '+' : ''}$${net.toFixed(2)}
                    </span>
                </div>
            `;
        }).join('');
    }
}

// --- FUNCIONES CRUD ---
elements.transForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = elements.transForm.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerText = 'Procesando...';
    
    const data = {
        userId: auth.currentUser.uid,
        type: document.getElementById('type').value,
        category: document.getElementById('category').value,
        amount: parseFloat(document.getElementById('amount').value),
        description: document.getElementById('description').value.toUpperCase(),
        date: document.getElementById('date').value,
        createdAt: serverTimestamp()
    };

    try { 
        await addDoc(collection(db, "transactions"), data); 
        showToast('Registro Guardado'); 
        elements.transForm.reset(); 
        document.getElementById('date').valueAsDate = new Date(); 
    }
    catch (e) { showToast('Error al Guardar', 'error'); }
    finally { btn.disabled = false; btn.innerText = 'Guardar Registro'; }
});

window.deleteTransaction = async (id) => {
    if (confirm('¿Estás seguro de eliminar este registro de la base de datos?')) {
        try { await deleteDoc(doc(db, "transactions", id)); showToast('Registro Eliminado'); }
        catch (e) { showToast('Error al Eliminar', 'error'); }
    }
};

window.openEditModal = async (id) => {
    const s = await getDocs(query(collection(db, "transactions"), where("userId", "==", auth.currentUser.uid)));
    const t = s.docs.find(d => d.id === id).data();
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-type').value = t.type;
    document.getElementById('edit-category').value = t.category;
    document.getElementById('edit-amount').value = t.amount;
    document.getElementById('edit-description').value = t.description;
    document.getElementById('edit-date').value = t.date;
    elements.modalEdit.classList.remove('hidden');
};

document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const d = {
        type: document.getElementById('edit-type').value,
        category: document.getElementById('edit-category').value,
        amount: parseFloat(document.getElementById('edit-amount').value),
        description: document.getElementById('edit-description').value.toUpperCase(),
        date: document.getElementById('edit-date').value
    };
    try { await updateDoc(doc(db, "transactions", id), d); showToast('Registro Actualizado'); elements.modalEdit.classList.add('hidden'); }
    catch (e) { showToast('Error al Actualizar', 'error'); }
});

window.deleteCategory = async (id) => {
    if (confirm('¿Eliminar categoría? (Los registros anteriores seguirán existiendo)')) {
        try { await deleteDoc(doc(db, "categories", id)); showToast('Categoría Eliminada'); }
        catch (e) { showToast('Error al Eliminar', 'error'); }
    }
};

document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-category-name').value.trim().toUpperCase();
    if (!name) return;
    try { await addDoc(collection(db, "categories"), { name, userId: auth.currentUser.uid }); document.getElementById('new-category-name').value = ''; showToast('Categoría Creada'); }
    catch (e) { showToast('Error al Crear', 'error'); }
});

// Eventos DOM e Inicialización
document.getElementById('btn-manage-categories').addEventListener('click', () => elements.modalCats.classList.remove('hidden'));
document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', () => { elements.modalEdit.classList.add('hidden'); elements.modalCats.classList.add('hidden'); }));

// Inicializar fechas y filtro
setupTheme();
const today = new Date();
document.getElementById('date').valueAsDate = today;
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
elements.monthFilter.value = currentMonth;
elements.monthFilter.addEventListener('change', renderCategoryFlow);