'use strict';

const storage = {
  KEY: 'borsCalcData',

  empty() {
    return { version: '1.0', accounts: [], stocks: [], transactions: [], snapshots: [] };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.empty();
      const data = JSON.parse(raw);
      data.accounts = data.accounts || [];
      data.stocks = data.stocks || [];
      data.transactions = data.transactions || [];
      data.snapshots = data.snapshots || [];
      data.accounts.forEach(a=>{
        if (!Array.isArray(a.capitalTransactions)) {
          a.capitalTransactions = [];
          const legacy = parseFloat(a.inactiveCapital)||0;
          if (legacy>0) a.capitalTransactions.push({id:'init_'+a.id,date:'',type:'deposit',amount:legacy,description:'موجودی اولیه'});
        }
      });
      return data;
    } catch(e) {
      console.error('Storage load error:', e);
      return this.empty();
    }
  },

  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch(e) {
      console.error('Storage save error:', e);
      console.error('خطا در ذخیره داده‌ها:', e.message);
    }
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  exportToFile(data) {
    const payload = {
      version: '1.0',
      description: 'فایل پشتیبان بورس‌کلک - برای بازیابی از طریق دکمه بازیابی استفاده کنید',
      exportDate: new Date().toISOString(),
      accounts: data.accounts,
      stocks: data.stocks,
      transactions: data.transactions,
      snapshots: data.snapshots || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bors-calc-backup-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!Array.isArray(data.accounts) || !Array.isArray(data.stocks) || !Array.isArray(data.transactions)) {
            throw new Error('فرمت فایل نامعتبر است');
          }
          this.save(data);
          resolve(data);
        } catch(err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
      reader.readAsText(file);
    });
  }
};

window.storage = storage;
