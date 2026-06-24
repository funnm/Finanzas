import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth, db } from "./firebase-config.js";

const elements = {
    app: document.getElementById("app-container"),
    auth: document.getElementById("auth-container"),
    transForm: document.getElementById("transaction-form"),
    history: document.getElementById("history-list"),
    incEl: document.getElementById("total-income"),
    expEl: document.getElementById("total-expense"),
    balEl: document.getElementById("total-balance"),
    user: document.getElementById("user-display"),
    syncStatus: document.getElementById("sync-status"),
    sessionStatus: document.getElementById("session-status"),
    themeBtn: document.getElementById("theme-toggle"),
    logoutBtn: document.getElementById("logout-btn"),
    toast: document.getElementById("toast"),
    catSelect: document.getElementById("category"),
    editCatSelect: document.getElementById("edit-category"),
    catList: document.getElementById("categories-list"),
    modalEdit: document.getElementById("modal-edit"),
    modalCats: document.getElementById("modal-categories"),
    dailySummary: document.getElementById("daily-summary"),
    monthFilter: document.getElementById("month-filter"),
    chartCanvas: document.getElementById("category-chart")
};

const moneyFormatter = new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD"
});

const baseCategories = {
    honorarios: { name: "Honorarios / Nomina" },
    equipamiento: { name: "Equipamiento" },
    software: { name: "Servicios digitales" },
    educacion: { name: "Formacion" },
    comida: { name: "Alimentacion" },
    transporte: { name: "Movilidad" }
};

let listeners = { trans: null, cats: null };
let currentTransactions = [];
let userCategoriesMap = { ...baseCategories };
let categoryChartInstance = null;

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
    }[char]));
}

function showToast(message, type = "success") {
    elements.toast.textContent = message;
    elements.toast.className = `toast show ${type}`;
    setTimeout(() => {
        elements.toast.className = "toast";
    }, 3500);
}

function formatMoney(value) {
    return moneyFormatter.format(Number(value) || 0);
}

function setSyncStatus(text) {
    if (elements.syncStatus) {
        elements.syncStatus.textContent = text;
    }
}

function setupTheme() {
    const storedTheme = localStorage.getItem("vault-theme");
    const useDark = storedTheme ? storedTheme === "dark" : false;

    document.body.classList.toggle("dark-theme", useDark);
    updateThemeButton();

    elements.themeBtn.addEventListener("click", () => {
        const nextDark = !document.body.classList.contains("dark-theme");
        document.body.classList.toggle("dark-theme", nextDark);
        localStorage.setItem("vault-theme", nextDark ? "dark" : "light");
        updateThemeButton();
        renderCategoryFlow();
    });
}

function updateThemeButton() {
    const isDark = document.body.classList.contains("dark-theme");
    elements.themeBtn.innerHTML = `<i class="fas ${isDark ? "fa-sun" : "fa-moon"}"></i>`;
    elements.themeBtn.setAttribute("title", isDark ? "Usar modo claro" : "Usar modo oscuro");
    elements.themeBtn.setAttribute("aria-label", isDark ? "Usar modo claro" : "Usar modo oscuro");
}

function stopListeners() {
    if (listeners.trans) listeners.trans();
    if (listeners.cats) listeners.cats();
    listeners = { trans: null, cats: null };
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        elements.auth.classList.add("hidden");
        elements.app.classList.remove("hidden");
        elements.user.textContent = user.email;
        elements.sessionStatus.textContent = `Sesion activa: ${user.email}`;
        setSyncStatus("Conectado");
        startSync(user.uid);
        return;
    }

    stopListeners();
    currentTransactions = [];
    elements.auth.classList.remove("hidden");
    elements.app.classList.add("hidden");
    elements.user.textContent = "";
    setSyncStatus("Sin sesion");
});

elements.logoutBtn.addEventListener("click", async () => {
    const shouldLogout = window.confirm("Deseas cerrar tu sesion?");
    if (!shouldLogout) return;

    try {
        await signOut(auth);
        showToast("Sesion cerrada.", "info");
    } catch (error) {
        showToast("No se pudo cerrar la sesion.", "error");
    }
});

function startSync(uid) {
    stopListeners();
    setSyncStatus("Sincronizando...");

    listeners.cats = onSnapshot(
        query(collection(db, "categories"), where("userId", "==", uid)),
        (snapshot) => {
            const userCategories = [];
            userCategoriesMap = { ...baseCategories };

            snapshot.forEach((entry) => {
                const data = entry.data();
                userCategories.push({ id: entry.id, ...data });
                userCategoriesMap[entry.id] = { name: data.name };
            });

            renderCats(userCategories);
            renderTable(currentTransactions);
            renderCategoryFlow();
        },
        () => showToast("No se pudieron cargar las categorias.", "error")
    );

    const orderedQuery = query(
        collection(db, "transactions"),
        where("userId", "==", uid),
        orderBy("date", "desc")
    );

    listeners.trans = onSnapshot(
        orderedQuery,
        (snapshot) => processTransactions(snapshot),
        () => {
            const fallbackQuery = query(collection(db, "transactions"), where("userId", "==", uid));
            listeners.trans = onSnapshot(
                fallbackQuery,
                (snapshot) => processTransactions(snapshot, true),
                () => showToast("No se pudieron cargar los movimientos.", "error")
            );
        }
    );
}

function processTransactions(snapshot, sort = false) {
    const list = [];
    let income = 0;
    let expense = 0;

    snapshot.forEach((entry) => {
        const data = entry.data();
        const amount = Number(data.amount) || 0;
        const transaction = { id: entry.id, ...data, amount };
        list.push(transaction);

        if (transaction.type === "income") {
            income += amount;
        } else {
            expense += amount;
        }
    });

    if (sort) {
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    currentTransactions = list;
    elements.incEl.textContent = formatMoney(income);
    elements.expEl.textContent = formatMoney(expense);
    elements.balEl.textContent = formatMoney(income - expense);
    setSyncStatus(`${list.length} movimientos`);

    renderTable(list);
    renderCategoryFlow();
    renderDailySummary(list);
}

function renderCats(userCategories) {
    const defaultList = Object.entries(baseCategories).map(([id, category]) => ({ id, name: category.name }));
    const allCategories = [...defaultList, ...userCategories].sort((a, b) => a.name.localeCompare(b.name));
    const options = allCategories
        .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`)
        .join("");

    elements.catSelect.innerHTML = options;
    elements.editCatSelect.innerHTML = options;

    if (userCategories.length === 0) {
        elements.catList.innerHTML = '<p class="empty-state">No hay categorias personalizadas.</p>';
        return;
    }

    elements.catList.innerHTML = userCategories
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((category) => `
            <div class="category-item">
                <span class="category-name">${escapeHtml(category.name)}</span>
                <button type="button" class="icon-button" data-delete-category="${escapeHtml(category.id)}" title="Eliminar categoria" aria-label="Eliminar categoria">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `)
        .join("");
}

function renderTable(list) {
    if (list.length === 0) {
        elements.history.innerHTML = `
            <tr class="empty-state">
                <td colspan="4">Todavia no hay movimientos. Registra el primero desde el formulario.</td>
            </tr>
        `;
        return;
    }

    elements.history.innerHTML = list.map((transaction) => {
        const categoryName = userCategoriesMap[transaction.category]?.name || transaction.category || "Sin categoria";
        const isIncome = transaction.type === "income";
        const sign = isIncome ? "+" : "-";

        return `
            <tr>
                <td>${escapeHtml(transaction.date || "")}</td>
                <td>
                    <p class="record-title">${escapeHtml(transaction.description || "Sin descripcion")}</p>
                    <p class="record-meta">${escapeHtml(categoryName)} · ${isIncome ? "Ingreso" : "Gasto"}</p>
                </td>
                <td class="amount-cell">${sign}${formatMoney(transaction.amount)}</td>
                <td>
                    <div class="row-actions">
                        <button type="button" class="icon-button" data-edit-transaction="${escapeHtml(transaction.id)}" title="Editar" aria-label="Editar movimiento">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button type="button" class="icon-button" data-delete-transaction="${escapeHtml(transaction.id)}" title="Eliminar" aria-label="Eliminar movimiento">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderCategoryFlow() {
    const context = elements.chartCanvas.getContext("2d");
    const filterMonth = elements.monthFilter.value;
    const isDark = document.body.classList.contains("dark-theme");
    const textColor = isDark ? "#b8b8b2" : "#626262";
    const gridColor = isDark ? "rgba(247, 247, 242, 0.1)" : "rgba(17, 17, 17, 0.1)";

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
        categoryChartInstance = null;
    }

    const filteredList = currentTransactions.filter((transaction) => {
        if (!filterMonth) return true;
        return String(transaction.date || "").startsWith(filterMonth);
    });

    const categoryFlow = {};
    filteredList.forEach((transaction) => {
        if (!categoryFlow[transaction.category]) categoryFlow[transaction.category] = 0;
        categoryFlow[transaction.category] += transaction.type === "income" ? transaction.amount : -transaction.amount;
    });

    const sortedKeys = Object.keys(categoryFlow)
        .sort((a, b) => Math.abs(categoryFlow[b]) - Math.abs(categoryFlow[a]))
        .slice(0, 6);

    if (sortedKeys.length === 0) {
        context.clearRect(0, 0, elements.chartCanvas.width, elements.chartCanvas.height);
        context.font = "13px Inter, sans-serif";
        context.fillStyle = textColor;
        context.textAlign = "center";
        context.fillText("Sin datos para el periodo", elements.chartCanvas.width / 2, elements.chartCanvas.height / 2);
        return;
    }

    categoryChartInstance = new Chart(context, {
        type: "bar",
        data: {
            labels: sortedKeys.map((id) => userCategoriesMap[id]?.name || id),
            datasets: [{
                label: "Balance neto",
                data: sortedKeys.map((id) => categoryFlow[id]),
                backgroundColor: sortedKeys.map((id) => categoryFlow[id] >= 0 ? "#111111" : "#8d8d87"),
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => formatMoney(context.parsed.y)
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        callback: (value) => formatMoney(value)
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            }
        }
    });
}

function renderDailySummary(list) {
    const dailyBalance = {};
    list.forEach((transaction) => {
        if (!dailyBalance[transaction.date]) dailyBalance[transaction.date] = 0;
        dailyBalance[transaction.date] += transaction.type === "income" ? transaction.amount : -transaction.amount;
    });

    const dailySortedKeys = Object.keys(dailyBalance)
        .sort((a, b) => new Date(b) - new Date(a))
        .slice(0, 6);

    if (dailySortedKeys.length === 0) {
        elements.dailySummary.innerHTML = '<p class="empty-state">Sin movimientos recientes.</p>';
        return;
    }

    elements.dailySummary.innerHTML = dailySortedKeys.map((date) => {
        const net = dailyBalance[date];
        return `
            <div class="daily-item">
                <span class="daily-date">${escapeHtml(date)}</span>
                <span class="daily-amount">${net >= 0 ? "+" : ""}${formatMoney(net)}</span>
            </div>
        `;
    }).join("");
}

elements.transForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = elements.transForm.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Guardando...";

    const data = {
        userId: auth.currentUser.uid,
        type: document.getElementById("type").value,
        category: document.getElementById("category").value,
        amount: Number.parseFloat(document.getElementById("amount").value),
        description: document.getElementById("description").value.trim(),
        date: document.getElementById("date").value,
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "transactions"), data);
        showToast("Movimiento guardado.");
        elements.transForm.reset();
        document.getElementById("date").valueAsDate = new Date();
    } catch (error) {
        showToast("No se pudo guardar el movimiento.", "error");
    } finally {
        button.disabled = false;
        button.textContent = "Guardar movimiento";
    }
});

async function deleteTransaction(id) {
    const shouldDelete = window.confirm("Eliminar este movimiento?");
    if (!shouldDelete) return;

    try {
        await deleteDoc(doc(db, "transactions", id));
        showToast("Movimiento eliminado.");
    } catch (error) {
        showToast("No se pudo eliminar el movimiento.", "error");
    }
}

function openEditModal(id) {
    const transaction = currentTransactions.find((entry) => entry.id === id);
    if (!transaction) {
        showToast("No se encontro el movimiento.", "error");
        return;
    }

    document.getElementById("edit-id").value = id;
    document.getElementById("edit-type").value = transaction.type;
    document.getElementById("edit-category").value = transaction.category;
    document.getElementById("edit-amount").value = transaction.amount;
    document.getElementById("edit-description").value = transaction.description || "";
    document.getElementById("edit-date").value = transaction.date || "";
    elements.modalEdit.classList.remove("hidden");
}

document.getElementById("edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = document.getElementById("edit-id").value;
    const data = {
        type: document.getElementById("edit-type").value,
        category: document.getElementById("edit-category").value,
        amount: Number.parseFloat(document.getElementById("edit-amount").value),
        description: document.getElementById("edit-description").value.trim(),
        date: document.getElementById("edit-date").value
    };

    try {
        await updateDoc(doc(db, "transactions", id), data);
        showToast("Movimiento actualizado.");
        closeModals();
    } catch (error) {
        showToast("No se pudo actualizar el movimiento.", "error");
    }
});

async function deleteCategory(id) {
    const shouldDelete = window.confirm("Eliminar esta categoria personalizada?");
    if (!shouldDelete) return;

    try {
        await deleteDoc(doc(db, "categories", id));
        showToast("Categoria eliminada.");
    } catch (error) {
        showToast("No se pudo eliminar la categoria.", "error");
    }
}

document.getElementById("category-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("new-category-name");
    const name = input.value.trim();
    if (!name) return;

    try {
        await addDoc(collection(db, "categories"), { name, userId: auth.currentUser.uid });
        input.value = "";
        showToast("Categoria creada.");
    } catch (error) {
        showToast("No se pudo crear la categoria.", "error");
    }
});

elements.history.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-transaction]");
    const deleteButton = event.target.closest("[data-delete-transaction]");

    if (editButton) openEditModal(editButton.dataset.editTransaction);
    if (deleteButton) deleteTransaction(deleteButton.dataset.deleteTransaction);
});

elements.catList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-category]");
    if (deleteButton) deleteCategory(deleteButton.dataset.deleteCategory);
});

document.getElementById("btn-manage-categories").addEventListener("click", () => {
    elements.modalCats.classList.remove("hidden");
});

document.querySelectorAll(".close-modal").forEach((button) => {
    button.addEventListener("click", closeModals);
});

document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModals();
    });
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModals();
});

function closeModals() {
    elements.modalEdit.classList.add("hidden");
    elements.modalCats.classList.add("hidden");
}

setupTheme();
const today = new Date();
document.getElementById("date").valueAsDate = today;
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
elements.monthFilter.value = currentMonth;
elements.monthFilter.addEventListener("change", renderCategoryFlow);
renderDailySummary([]);
