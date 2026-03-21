// المتغيرات لحفظ حالة التطبيق
let currentReceiptValue = 0;
let invoices = [];
let invoiceCounter = 1000;

// دالة التنقل بين التبويبات
function switchTab(tabId, element) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
}

// دالة تنسيق الرقم بإضافة النقاط (مثال: 100.000)
function formatNumberWithDots(num) {
    if (!num) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// دالة إزالة النقاط وتحويل النص إلى رقم صحيح
function parseNumberFromDots(str) {
    if (!str) return 0;
    return Number(str.replace(/\./g, '')) || 0;
}

// دالة يتم استدعاؤها أثناء الكتابة في الحقل لتنسيق الرقم فوراً
function handleNumberInput(input) {
    let val = input.value.replace(/\D/g, ''); // إبقاء الأرقام فقط
    input.value = formatNumberWithDots(val);
}

// حفظ سند القبض
function saveReceive() {
    const input = document.getElementById('receive-amount');
    let amount = parseNumberFromDots(input.value);
    
    if (amount <= 0) return;

    currentReceiptValue = amount;
    
    // جعل الحقل غير قابل للكتابة
    input.readOnly = true;
    
    // إخفاء زر الإضافة وإظهار زر التعديل
    document.getElementById('btn-save-receive').style.display = 'none';
    document.getElementById('btn-edit-receive').style.display = 'block';

    updateUI();
}

// تعديل سند القبض
function editReceive() {
    const input = document.getElementById('receive-amount');
    
    // جعل الحقل قابل للكتابة
    input.readOnly = false;
    
    // إخفاء زر التعديل وإظهار زر الإضافة
    document.getElementById('btn-save-receive').style.display = 'block';
    document.getElementById('btn-edit-receive').style.display = 'none';
    
    input.focus();
}

// إضافة سند صرف
function saveSpend() {
    const nameInput = document.getElementById('spend-name');
    const amountInput = document.getElementById('spend-amount');
    
    let name = nameInput.value.trim();
    let amount = parseNumberFromDots(amountInput.value);

    if (name === "" || amount <= 0) return;

    let totalPayments = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    let available = currentReceiptValue - totalPayments;

    if (amount > available) {
        alert("الرصيد المتاح لا يكفي!");
        return;
    }

    // إضافة الفاتورة
    invoiceCounter++;
    let invoice = {
        id: invoiceCounter,
        name: name,
        amount: amount,
        date: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    };

    invoices.push(invoice);

    // تفريغ الحقول
    nameInput.value = "";
    amountInput.value = "";

    updateUI();
}

// تعديل مبلغ الفاتورة
function editInvoice(id) {
    let invoice = invoices.find(inv => inv.id === id);
    if (!invoice) return;

    let newAmountStr = prompt("أدخل مبلغ الصرف الجديد (الزيادة أو النقصان):", formatNumberWithDots(invoice.amount));
    if (newAmountStr === null || newAmountStr.trim() === "") return;

    let newAmount = parseNumberFromDots(newAmountStr);
    if (newAmount >= 0) {
        let totalPaymentsExceptCurrent = invoices.reduce((sum, inv) => inv.id !== id ? sum + inv.amount : sum, 0);
        let availableIfChanged = currentReceiptValue - totalPaymentsExceptCurrent;

        if (newAmount > availableIfChanged) {
            alert("الرصيد المتاح لا يكفي للزيادة المطلوبة!");
            return;
        }

        invoice.amount = newAmount;
        updateUI();
    }
}

// حذف الفاتورة
function deleteInvoice(id) {
    invoices = invoices.filter(inv => inv.id !== id);
    updateUI();
}

// تحديث الواجهة والبيانات في كافة التبويبات
function updateUI() {
    // حساب المجاميع
    let totalPayments = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    let availableBalance = currentReceiptValue - totalPayments;

    // 1. تحديث تبويب الرئيسية
    document.getElementById('home-available').innerText = formatNumberWithDots(availableBalance);
    document.getElementById('home-receipts').innerText = formatNumberWithDots(currentReceiptValue);
    document.getElementById('home-payments').innerText = formatNumberWithDots(totalPayments);

    // 2. تحديث تبويب التقارير
    document.getElementById('report-balance').innerText = formatNumberWithDots(availableBalance) + " د.ع";
    document.getElementById('report-receipts').innerText = formatNumberWithDots(currentReceiptValue) + " د.ع";
    document.getElementById('report-payments').innerText = formatNumberWithDots(totalPayments) + " د.ع";
    document.getElementById('report-invoice-count').innerText = invoices.length;

    // 3. تحديث قائمة الفواتير
    const invoiceContainer = document.getElementById('invoice-list-container');
    invoiceContainer.innerHTML = '';

    invoices.forEach(inv => {
        const itemHTML = `
            <div class="invoice-item 3d-effect">
                <div class="invoice-details">
                    <h4>فاتورة #${inv.id} - ${inv.name}</h4>
                    <p>المبلغ: <span class="text-red font-bold">${formatNumberWithDots(inv.amount)}</span> د.ع</p>
                    <p>التاريخ: ${inv.date}</p>
                </div>
                <div class="invoice-actions">
                    <i class="fa-solid fa-pen text-blue" onclick="editInvoice(${inv.id})"></i>
                    <i class="fa-solid fa-trash text-red" onclick="deleteInvoice(${inv.id})"></i>
                </div>
            </div>
        `;
        invoiceContainer.insertAdjacentHTML('beforeend', itemHTML);
    });
}

// تهيئة الواجهة عند تحميل الصفحة
window.onload = () => {
    updateUI();
};
