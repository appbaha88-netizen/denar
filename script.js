let currentReceipt = {
    number: '',
    amount: 0,
    remaining: 0,
    saved: false
};

let invoices = [];
let invoiceCounter = 1000;

function switchTab(tabId, element) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
}

function formatNumberWithDots(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseNumberFromDots(str) {
    if (!str) return 0;
    return Number(str.replace(/\./g, '')) || 0;
}

function handleNumberInput(input) {
    let val = input.value.replace(/\D/g, '');
    input.value = formatNumberWithDots(val);
}

function getCurrentDate() {
    return new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function saveReceive() {
    const numberInput = document.getElementById('receive-number');
    const amountInput = document.getElementById('receive-amount');
    const saveStatus = document.getElementById('receive-save-status');

    const receiptNumber = numberInput.value.trim();
    const amount = parseNumberFromDots(amountInput.value);

    if (receiptNumber === '' || amount <= 0) return;

    currentReceipt.number = receiptNumber;
    currentReceipt.amount = amount;
    currentReceipt.remaining = amount;
    currentReceipt.saved = true;

    numberInput.readOnly = true;
    amountInput.readOnly = true;
    saveStatus.innerText = 'تم الحفظ';

    invoiceCounter++;
    invoices.push({
        id: invoiceCounter,
        type: 'قبض',
        name: 'سند قبض',
        amount: amount,
        date: getCurrentDate(),
        receiptNumber: receiptNumber
    });

    updateUI();
}

function startNewReceipt() {
    const numberInput = document.getElementById('receive-number');
    const amountInput = document.getElementById('receive-amount');
    const saveStatus = document.getElementById('receive-save-status');

    currentReceipt.number = '';
    currentReceipt.amount = 0;
    currentReceipt.remaining = 0;
    currentReceipt.saved = false;

    numberInput.value = '';
    amountInput.value = '';
    numberInput.readOnly = false;
    amountInput.readOnly = false;
    saveStatus.innerText = '';

    updateUI();
}

function saveSpend() {
    const nameInput = document.getElementById('spend-name');
    const amountInput = document.getElementById('spend-amount');

    const name = nameInput.value.trim();
    const amount = parseNumberFromDots(amountInput.value);

    if (!currentReceipt.saved) return;
    if (name === '' || amount <= 0) return;
    if (amount > currentReceipt.remaining) return;

    currentReceipt.remaining -= amount;

    invoiceCounter++;
    invoices.push({
        id: invoiceCounter,
        type: 'صرف',
        name: name,
        amount: amount,
        date: getCurrentDate(),
        receiptNumber: currentReceipt.number
    });

    nameInput.value = '';
    amountInput.value = '';

    updateUI();
}

function updateUI() {
    const totalReceipts = invoices
        .filter(inv => inv.type === 'قبض')
        .reduce((sum, inv) => sum + inv.amount, 0);

    const totalPayments = invoices
        .filter(inv => inv.type === 'صرف')
        .reduce((sum, inv) => sum + inv.amount, 0);

    const availableBalance = totalReceipts - totalPayments;

    document.getElementById('home-available').innerText = formatNumberWithDots(availableBalance);
    document.getElementById('home-receipts').innerText = formatNumberWithDots(totalReceipts);
    document.getElementById('home-payments').innerText = formatNumberWithDots(totalPayments);

    document.getElementById('report-balance').innerText = formatNumberWithDots(availableBalance) + ' د.ع';
    document.getElementById('report-receipts').innerText = formatNumberWithDots(totalReceipts) + ' د.ع';
    document.getElementById('report-payments').innerText = formatNumberWithDots(totalPayments) + ' د.ع';
    document.getElementById('report-invoice-count').innerText = invoices.length;

    document.getElementById('current-receipt-balance').innerText = formatNumberWithDots(currentReceipt.remaining);

    const invoiceContainer = document.getElementById('invoice-list-container');
    invoiceContainer.innerHTML = '';

    invoices.slice().reverse().forEach(inv => {
        const amountClass = inv.type === 'قبض' ? 'text-green' : 'text-red';
        const itemHTML = `
            <div class="invoice-item effect-3d">
                <div class="invoice-details">
                    <h4>${inv.type}</h4>
                    <p>رقم سند القبض: ${inv.receiptNumber}</p>
                    <p>الاسم: ${inv.name}</p>
                    <p>المبلغ: <span class="${amountClass} font-bold">${formatNumberWithDots(inv.amount)}</span> د.ع</p>
                    <p>التاريخ: ${inv.date}</p>
                </div>
            </div>
        `;
        invoiceContainer.insertAdjacentHTML('beforeend', itemHTML);
    });
}

window.onload = () => {
    updateUI();
};
