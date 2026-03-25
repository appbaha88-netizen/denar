import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMoFNKuUte8XPVvJsQg8PHLxkaTTndpG8",
    authDomain: "bonds-app-e4137.firebaseapp.com",
    projectId: "bonds-app-e4137",
    storageBucket: "bonds-app-e4137.firebasestorage.app",
    messagingSenderId: "1033985636165",
    appId: "1:1033985636165:web:117a1f3daad4d7eb58b02c",
    measurementId: "G-1Q09H5V385"
};

const FIRESTORE_TRANSACTIONS_COLLECTION = "transactions";
const FIRESTORE_META_COLLECTION = "meta";
const FIRESTORE_APP_STATE_DOC = "app-state";
const DATABASE_NAME = "denar-offline-db";
const DATABASE_VERSION = 1;
const TRANSACTIONS_STORE = "transactions";
const APP_STATE_STORE = "appState";
const QUEUE_STORE = "syncQueue";
const SETTINGS_STORE = "settings";
const DEVICE_ID_KEY = "device-id";

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

void analytics;

let indexedDbPromise = null;
let currentReceipt = {
    id: null,
    number: "",
    amount: 0,
    remaining: 0,
    saved: false,
    updatedAt: 0
};
let transactions = [];
let syncInProgress = false;
let deviceId = "";

const elements = {};

function cacheDomElements() {
    elements.connectionStatusText = document.getElementById("connection-status-text");
    elements.pendingOperationsCount = document.getElementById("pending-operations-count");
    elements.receiveNumber = document.getElementById("receive-number");
    elements.receiveAmount = document.getElementById("receive-amount");
    elements.receiveSaveStatus = document.getElementById("receive-save-status");
    elements.spendName = document.getElementById("spend-name");
    elements.spendAmount = document.getElementById("spend-amount");
    elements.homeAvailable = document.getElementById("home-available");
    elements.homeReceipts = document.getElementById("home-receipts");
    elements.homePayments = document.getElementById("home-payments");
    elements.reportBalance = document.getElementById("report-balance");
    elements.reportReceipts = document.getElementById("report-receipts");
    elements.reportPayments = document.getElementById("report-payments");
    elements.reportInvoiceCount = document.getElementById("report-invoice-count");
    elements.currentReceiptBalance = document.getElementById("current-receipt-balance");
    elements.invoiceListContainer = document.getElementById("invoice-list-container");
    elements.reportDateFrom = document.getElementById("report-date-from");
    elements.reportDateTo = document.getElementById("report-date-to");
    elements.btnSaveReceive = document.getElementById("btn-save-receive");
    elements.btnNewReceive = document.getElementById("btn-new-receive");
    elements.btnSaveSpend = document.getElementById("btn-save-spend");
    elements.btnSearchReports = document.getElementById("btn-search-reports");
}

function openDatabase() {
    if (indexedDbPromise) return indexedDbPromise;

    indexedDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains(TRANSACTIONS_STORE)) {
                const transactionsStore = database.createObjectStore(TRANSACTIONS_STORE, { keyPath: "id" });
                transactionsStore.createIndex("updatedAt", "updatedAt", { unique: false });
            }

            if (!database.objectStoreNames.contains(APP_STATE_STORE)) {
                database.createObjectStore(APP_STATE_STORE, { keyPath: "key" });
            }

            if (!database.objectStoreNames.contains(QUEUE_STORE)) {
                const queueStore = database.createObjectStore(QUEUE_STORE, { keyPath: "id" });
                queueStore.createIndex("entityKey", "entityKey", { unique: false });
                queueStore.createIndex("createdAt", "createdAt", { unique: false });
            }

            if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
                database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return indexedDbPromise;
}

async function idbGetAll(storeName) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbGet(storeName, key) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbPut(storeName, value) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve(value);
        request.onerror = () => reject(request.error);
    });
}

async function idbDelete(storeName, key) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
        try {
            await navigator.serviceWorker.register("./sw.js");
        } catch (error) {
            console.error(error);
        }
    }
}

function generateId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getOrCreateDeviceId() {
    const existing = await idbGet(SETTINGS_STORE, DEVICE_ID_KEY);
    if (existing?.value) {
        return existing.value;
    }
    const created = generateId("device");
    await idbPut(SETTINGS_STORE, { key: DEVICE_ID_KEY, value: created });
    return created;
}

function formatNumberWithDots(num) {
    const numberValue = Number(num) || 0;
    const isNegative = numberValue < 0;
    const absoluteValue = Math.abs(numberValue);
    const formattedValue = absoluteValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return isNegative ? `-${formattedValue}` : formattedValue;
}

function parseNumberFromDots(value) {
    if (!value) return 0;
    return Number(value.toString().replace(/\./g, "")) || 0;
}

function handleNumberInput(event) {
    const rawValue = event.target.value.replace(/\D/g, "");
    event.target.value = rawValue ? formatNumberWithDots(rawValue) : "";
}

function formatDisplayDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

function getCurrentDate() {
    return new Date().toISOString().split("T")[0];
}

function getCurrentTimestamp() {
    return Date.now();
}

function sanitizeRecordForRemote(record) {
    const cleaned = { ...record };
    delete cleaned.syncStatus;
    delete cleaned.pending;
    return cleaned;
}

function normalizeTransaction(record) {
    return {
        id: record.id,
        type: record.type,
        name: record.name,
        amount: Number(record.amount) || 0,
        date: record.date,
        receiptNumber: record.receiptNumber || "",
        receiptId: record.receiptId || null,
        deleted: Boolean(record.deleted),
        createdAt: Number(record.createdAt) || 0,
        updatedAt: Number(record.updatedAt) || 0,
        deviceId: record.deviceId || "",
        serverUpdatedAt: record.serverUpdatedAt || null
    };
}

function normalizeAppState(record) {
    return {
        id: record.id || null,
        number: record.number || "",
        amount: Number(record.amount) || 0,
        remaining: Number(record.remaining) || 0,
        saved: Boolean(record.saved),
        updatedAt: Number(record.updatedAt) || 0,
        deviceId: record.deviceId || "",
        serverUpdatedAt: record.serverUpdatedAt || null
    };
}

function mergeRecords(localRecord, remoteRecord) {
    if (!localRecord && remoteRecord) return remoteRecord;
    if (localRecord && !remoteRecord) return localRecord;
    if (!localRecord && !remoteRecord) return null;
    return Number(localRecord.updatedAt || 0) >= Number(remoteRecord.updatedAt || 0)
        ? { ...remoteRecord, ...localRecord }
        : { ...localRecord, ...remoteRecord };
}

async function loadLocalState() {
    const localTransactions = await idbGetAll(TRANSACTIONS_STORE);
    const savedAppState = await idbGet(APP_STATE_STORE, "currentReceipt");

    transactions = localTransactions.map(normalizeTransaction).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

    if (savedAppState?.value) {
        currentReceipt = normalizeAppState(savedAppState.value);
    }

    recalculateReceiptRemaining();
    renderAll();
}

function recalculateReceiptRemaining() {
    const totalReceipts = getVisibleTransactionsByType("قبض").reduce((sum, item) => sum + item.amount, 0);
    const totalPayments = getVisibleTransactionsByType("صرف").reduce((sum, item) => sum + item.amount, 0);
    currentReceipt.remaining = totalReceipts - totalPayments;
}

function getVisibleTransactions() {
    return transactions.filter((item) => !item.deleted);
}

function getVisibleTransactionsByType(type) {
    return getVisibleTransactions().filter((item) => item.type === type);
}

function getAvailableBalance() {
    const totalReceipts = getVisibleTransactionsByType("قبض").reduce((sum, item) => sum + item.amount, 0);
    const totalPayments = getVisibleTransactionsByType("صرف").reduce((sum, item) => sum + item.amount, 0);
    return totalReceipts - totalPayments;
}

function switchTab(tabId, buttonElement) {
    document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach((button) => button.classList.remove("active"));

    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add("active");
    }

    if (buttonElement) {
        buttonElement.classList.add("active");
    }
}

async function persistAppState(queue = true) {
    const stateToSave = normalizeAppState({
        ...currentReceipt,
        deviceId,
        updatedAt: currentReceipt.updatedAt || getCurrentTimestamp()
    });

    await idbPut(APP_STATE_STORE, { key: "currentReceipt", value: stateToSave });

    if (queue) {
        await enqueueOperation({
            id: generateId("queue-app-state"),
            entityKey: "appState:currentReceipt",
            entityType: "appState",
            action: "upsert",
            payload: stateToSave,
            createdAt: getCurrentTimestamp()
        });
    }
}

async function persistTransaction(transaction, queue = true) {
    await idbPut(TRANSACTIONS_STORE, transaction);

    const existingIndex = transactions.findIndex((item) => item.id === transaction.id);
    if (existingIndex >= 0) {
        transactions[existingIndex] = transaction;
    } else {
        transactions.unshift(transaction);
    }

    transactions.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

    if (queue) {
        await enqueueOperation({
            id: generateId("queue-transaction"),
            entityKey: `transaction:${transaction.id}`,
            entityType: "transaction",
            action: "upsert",
            payload: transaction,
            createdAt: getCurrentTimestamp()
        });
    }
}

async function enqueueOperation(operation) {
    const queueItems = await idbGetAll(QUEUE_STORE);
    const duplicate = queueItems.find((item) => item.entityKey === operation.entityKey);

    if (duplicate) {
        await idbPut(QUEUE_STORE, {
            ...duplicate,
            action: operation.action,
            payload: operation.payload,
            createdAt: operation.createdAt
        });
    } else {
        await idbPut(QUEUE_STORE, operation);
    }

    await updatePendingOperationsCount();
}

async function updatePendingOperationsCount() {
    const queueItems = await idbGetAll(QUEUE_STORE);
    elements.pendingOperationsCount.textContent = String(queueItems.length);
}

function setConnectionStatus(status) {
    elements.connectionStatusText.textContent = status;
    document.body.dataset.connectionStatus = status;
}

async function syncRemoteToLocal() {
    const remoteTransactionsSnapshot = await getDocs(collection(db, FIRESTORE_TRANSACTIONS_COLLECTION));
    const remoteTransactions = remoteTransactionsSnapshot.docs.map((snapshot) => normalizeTransaction(snapshot.data()));

    for (const remoteRecord of remoteTransactions) {
        const localRecord = await idbGet(TRANSACTIONS_STORE, remoteRecord.id);
        const mergedRecord = normalizeTransaction(mergeRecords(localRecord, remoteRecord));
        await idbPut(TRANSACTIONS_STORE, mergedRecord);
    }

    const remoteAppStateSnapshot = await getDoc(doc(db, FIRESTORE_META_COLLECTION, FIRESTORE_APP_STATE_DOC));
    if (remoteAppStateSnapshot.exists()) {
        const remoteAppState = normalizeAppState(remoteAppStateSnapshot.data());
        const localAppStateWrapper = await idbGet(APP_STATE_STORE, "currentReceipt");
        const localAppState = localAppStateWrapper?.value ? normalizeAppState(localAppStateWrapper.value) : null;
        const mergedAppState = normalizeAppState(mergeRecords(localAppState, remoteAppState));
        await idbPut(APP_STATE_STORE, { key: "currentReceipt", value: mergedAppState });
    }

    await loadLocalState();
}

async function syncQueueWithServer() {
    if (!navigator.onLine || syncInProgress) return;

    syncInProgress = true;
    setConnectionStatus("syncing");

    try {
        await syncRemoteToLocal();

        const queueItems = (await idbGetAll(QUEUE_STORE)).sort((a, b) => Number(a.createdAt) - Number(b.createdAt));

        for (const operation of queueItems) {
            if (operation.entityType === "transaction") {
                const transactionDocRef = doc(db, FIRESTORE_TRANSACTIONS_COLLECTION, operation.payload.id);
                const remoteSnapshot = await getDoc(transactionDocRef);
                const remoteRecord = remoteSnapshot.exists() ? normalizeTransaction(remoteSnapshot.data()) : null;
                const localRecord = normalizeTransaction(operation.payload);
                const mergedRecord = normalizeTransaction(mergeRecords(localRecord, remoteRecord));

                await setDoc(transactionDocRef, {
                    ...sanitizeRecordForRemote(mergedRecord),
                    serverUpdatedAt: serverTimestamp()
                }, { merge: true });
            }

            if (operation.entityType === "appState") {
                const appStateDocRef = doc(db, FIRESTORE_META_COLLECTION, FIRESTORE_APP_STATE_DOC);
                const remoteSnapshot = await getDoc(appStateDocRef);
                const remoteRecord = remoteSnapshot.exists() ? normalizeAppState(remoteSnapshot.data()) : null;
                const localRecord = normalizeAppState(operation.payload);
                const mergedRecord = normalizeAppState(mergeRecords(localRecord, remoteRecord));

                await setDoc(appStateDocRef, {
                    ...sanitizeRecordForRemote(mergedRecord),
                    serverUpdatedAt: serverTimestamp()
                }, { merge: true });
            }

            await idbDelete(QUEUE_STORE, operation.id);
        }

        await syncRemoteToLocal();
        setConnectionStatus("online");
    } catch (error) {
        console.error(error);
        setConnectionStatus(navigator.onLine ? "online" : "offline");
    } finally {
        syncInProgress = false;
        await updatePendingOperationsCount();
    }
}

async function saveReceive() {
    const receiptNumber = elements.receiveNumber.value.trim();
    const amount = parseNumberFromDots(elements.receiveAmount.value);

    if (receiptNumber === "" || amount <= 0) return;

    const now = getCurrentTimestamp();
    const receiptId = currentReceipt.id || generateId("receipt");

    currentReceipt = normalizeAppState({
        id: receiptId,
        number: receiptNumber,
        amount,
        saved: true,
        updatedAt: now,
        deviceId
    });

    elements.receiveNumber.readOnly = true;
    elements.receiveAmount.readOnly = true;
    elements.receiveSaveStatus.textContent = "تم الحفظ";

    const newTransaction = normalizeTransaction({
        id: generateId("transaction"),
        type: "قبض",
        name: "سند قبض",
        amount,
        date: getCurrentDate(),
        receiptNumber,
        receiptId,
        deleted: false,
        createdAt: now,
        updatedAt: now,
        deviceId
    });

    await persistTransaction(newTransaction, true);
    recalculateReceiptRemaining();
    currentReceipt.updatedAt = getCurrentTimestamp();
    await persistAppState(true);
    renderAll();

    if (navigator.onLine) {
        await syncQueueWithServer();
    }
}

async function startNewReceipt() {
    currentReceipt = normalizeAppState({
        id: null,
        number: "",
        amount: 0,
        saved: false,
        updatedAt: getCurrentTimestamp(),
        deviceId
    });

    elements.receiveNumber.value = "";
    elements.receiveAmount.value = "";
    elements.receiveNumber.readOnly = false;
    elements.receiveAmount.readOnly = false;
    elements.receiveSaveStatus.textContent = "";

    recalculateReceiptRemaining();
    await persistAppState(true);
    renderAll();

    if (navigator.onLine) {
        await syncQueueWithServer();
    }
}

async function saveSpend() {
    const personName = elements.spendName.value.trim();
    const amount = parseNumberFromDots(elements.spendAmount.value);

    if (!currentReceipt.saved) return;
    if (personName === "" || amount <= 0) return;

    const now = getCurrentTimestamp();
    const newTransaction = normalizeTransaction({
        id: generateId("transaction"),
        type: "صرف",
        name: personName,
        amount,
        date: getCurrentDate(),
        receiptNumber: currentReceipt.number,
        receiptId: currentReceipt.id,
        deleted: false,
        createdAt: now,
        updatedAt: now,
        deviceId
    });

    await persistTransaction(newTransaction, true);
    recalculateReceiptRemaining();
    currentReceipt.updatedAt = getCurrentTimestamp();
    await persistAppState(true);

    elements.spendName.value = "";
    elements.spendAmount.value = "";

    renderAll();

    if (navigator.onLine) {
        await syncQueueWithServer();
    }
}

async function editTransaction(id) {
    const transaction = transactions.find((item) => item.id === id);
    if (!transaction) return;

    const newName = window.prompt("الاسم", transaction.name);
    if (newName === null || newName.trim() === "") return;

    const newAmountInput = window.prompt("المبلغ", formatNumberWithDots(transaction.amount));
    if (newAmountInput === null || newAmountInput.trim() === "") return;

    const newAmount = parseNumberFromDots(newAmountInput);
    if (newAmount <= 0) return;

    const updatedTransaction = normalizeTransaction({
        ...transaction,
        name: newName.trim(),
        amount: newAmount,
        updatedAt: getCurrentTimestamp(),
        deviceId
    });

    await persistTransaction(updatedTransaction, true);
    recalculateReceiptRemaining();
    currentReceipt.updatedAt = getCurrentTimestamp();
    await persistAppState(true);
    renderAll();

    if (navigator.onLine) {
        await syncQueueWithServer();
    }
}

async function deleteTransaction(id) {
    const transaction = transactions.find((item) => item.id === id);
    if (!transaction) return;

    const updatedTransaction = normalizeTransaction({
        ...transaction,
        deleted: true,
        updatedAt: getCurrentTimestamp(),
        deviceId
    });

    await persistTransaction(updatedTransaction, true);
    recalculateReceiptRemaining();
    currentReceipt.updatedAt = getCurrentTimestamp();
    await persistAppState(true);
    renderAll();

    if (navigator.onLine) {
        await syncQueueWithServer();
    }
}

function filterTransactionsByDate(fromDate, toDate) {
    if (!fromDate || !toDate) {
        return getVisibleTransactions();
    }
    return getVisibleTransactions().filter((item) => item.date >= fromDate && item.date <= toDate);
}

function renderReports(filteredTransactions = null) {
    const sourceTransactions = filteredTransactions || getVisibleTransactions();
    const totalReceipts = sourceTransactions.filter((item) => item.type === "قبض").reduce((sum, item) => sum + item.amount, 0);
    const totalPayments = sourceTransactions.filter((item) => item.type === "صرف").reduce((sum, item) => sum + item.amount, 0);
    const balance = totalReceipts - totalPayments;

    elements.reportBalance.textContent = `${formatNumberWithDots(balance)} د.ع`;
    elements.reportReceipts.textContent = `${formatNumberWithDots(totalReceipts)} د.ع`;
    elements.reportPayments.textContent = `${formatNumberWithDots(totalPayments)} د.ع`;
    elements.reportInvoiceCount.textContent = String(sourceTransactions.length);
}

function searchReports() {
    const filteredTransactions = filterTransactionsByDate(elements.reportDateFrom.value, elements.reportDateTo.value);
    renderReports(filteredTransactions);
}

function renderInvoices() {
    const visibleTransactions = getVisibleTransactions();
    elements.invoiceListContainer.innerHTML = "";

    visibleTransactions.forEach((transaction) => {
        const amountClass = transaction.type === "قبض" ? "text-green" : "text-red";
        const item = document.createElement("div");
        item.className = "invoice-item effect-3d";
        item.innerHTML = `
            <div class="invoice-details">
                <h4>${transaction.type}</h4>
                <p>رقم سند القبض: ${transaction.receiptNumber || ""}</p>
                <p>الاسم: ${transaction.name}</p>
                <p>المبلغ: <span class="${amountClass} font-bold">${formatNumberWithDots(transaction.amount)}</span> د.ع</p>
                <p>التاريخ: ${formatDisplayDate(transaction.date)}</p>
            </div>
            <div class="invoice-actions">
                <button class="icon-btn text-blue" data-action="edit" data-id="${transaction.id}"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn text-red" data-action="delete" data-id="${transaction.id}"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        elements.invoiceListContainer.appendChild(item);
    });
}

function renderHome() {
    const totalReceipts = getVisibleTransactionsByType("قبض").reduce((sum, item) => sum + item.amount, 0);
    const totalPayments = getVisibleTransactionsByType("صرف").reduce((sum, item) => sum + item.amount, 0);
    const availableBalance = totalReceipts - totalPayments;

    elements.homeAvailable.textContent = formatNumberWithDots(availableBalance);
    elements.homeReceipts.textContent = formatNumberWithDots(totalReceipts);
    elements.homePayments.textContent = formatNumberWithDots(totalPayments);
    elements.currentReceiptBalance.textContent = formatNumberWithDots(currentReceipt.remaining);
}

function renderReceiptForm() {
    elements.receiveNumber.value = currentReceipt.number || "";
    elements.receiveAmount.value = currentReceipt.amount ? formatNumberWithDots(currentReceipt.amount) : "";
    elements.receiveNumber.readOnly = currentReceipt.saved;
    elements.receiveAmount.readOnly = currentReceipt.saved;
}

function renderAll() {
    recalculateReceiptRemaining();
    renderReceiptForm();
    renderHome();
    renderInvoices();
    renderReports();
}

function bindEvents() {
    document.querySelectorAll(".nav-btn").forEach((button) => {
        button.addEventListener("click", () => switchTab(button.dataset.tab, button));
    });

    elements.receiveAmount.addEventListener("input", handleNumberInput);
    elements.spendAmount.addEventListener("input", handleNumberInput);
    elements.btnSaveReceive.addEventListener("click", saveReceive);
    elements.btnNewReceive.addEventListener("click", startNewReceipt);
    elements.btnSaveSpend.addEventListener("click", saveSpend);
    elements.btnSearchReports.addEventListener("click", searchReports);

    elements.invoiceListContainer.addEventListener("click", async (event) => {
        const actionButton = event.target.closest("button[data-action]");
        if (!actionButton) return;

        const { action, id } = actionButton.dataset;
        if (action === "edit") {
            await editTransaction(id);
        }
        if (action === "delete") {
            await deleteTransaction(id);
        }
    });

    window.addEventListener("online", async () => {
        setConnectionStatus(syncInProgress ? "syncing" : "online");
        await syncQueueWithServer();
    });

    window.addEventListener("offline", () => {
        setConnectionStatus("offline");
    });
}

async function initializeAppState() {
    await openDatabase();
    deviceId = await getOrCreateDeviceId();
    cacheDomElements();
    bindEvents();
    await loadLocalState();
    await updatePendingOperationsCount();
    setConnectionStatus(navigator.onLine ? "online" : "offline");
    await registerServiceWorker();

    if (navigator.onLine) {
        await syncQueueWithServer();
    }
}

initializeAppState();
