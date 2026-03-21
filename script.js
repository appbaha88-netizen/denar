/**
 * دالة لتغيير التبويبات عند النقر على أزرار شريط التنقل السفلي
 * @param {string} tabId - مُعرّف التبويب المراد إظهاره
 * @param {HTMLElement} element - الزر الذي تم النقر عليه
 */
function switchTab(tabId, element) {
    // 1. إخفاء جميع التبويبات
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });

    // 2. إزالة حالة "النشط" (اللون الأزرق) من جميع أزرار التنقل
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.classList.remove('active');
    });

    // 3. إظهار التبويب المطلوب
    document.getElementById(tabId).classList.add('active');

    // 4. إضافة حالة "النشط" للزر الذي تم النقر عليه
    element.classList.add('active');
}

/**
 * دالة تفاعلية لأزرار الحفظ في تبويب السندات
 * @param {string} type - نوع السند (قبض أو صرف)
 */
function saveData(type) {
    if (type === 'قبض') {
        const amount = document.getElementById('receive-amount').value;
        if (amount === "") {
            alert('الرجاء إدخال مبلغ القبض');
            return;
        }
        alert('تم حفظ سند القبض بنجاح! المبلغ: ' + amount);
        // تفريغ الحقل بعد الحفظ
        document.getElementById('receive-amount').value = "";
    } 
    else if (type === 'صرف') {
        const name = document.getElementById('spend-name').value;
        const amount = document.getElementById('spend-amount').value;
        
        if (name === "" || amount === "") {
            alert('الرجاء تعبئة جميع الحقول (الاسم والمبلغ)');
            return;
        }
        alert('تم حفظ سند الصرف بنجاح!\nالاسم: ' + name + '\nالمبلغ: ' + amount);
        // تفريغ الحقول بعد الحفظ
        document.getElementById('spend-name').value = "";
        document.getElementById('spend-amount').value = "";
    }
}
