'use strict';

// Jalali (Solar Hijri) <-> Gregorian calendar conversions
// Algorithms verified: 2025/03/21 -> 1404/01/01, 2025/09/14 -> 1404/06/23

const jalali = {
  monthNames: ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
               'مهر','آبان','آذر','دی','بهمن','اسفند'],

  // Convert Gregorian to Jalali
  toJalali(gy, gm, gd) {
    const g = [0,31,59,90,120,151,181,212,243,273,304,334];
    let gy2 = gm > 2 ? gy + 1 : gy;
    let days = 355666 + 365*gy
      + Math.floor((gy2+3)/4)
      - Math.floor((gy2+99)/100)
      + Math.floor((gy2+399)/400)
      + gd + g[gm-1];
    let jy = -1595 + 33 * Math.floor(days/12053);
    days %= 12053;
    jy += 4 * Math.floor(days/1461);
    days %= 1461;
    if (days > 365) { jy += Math.floor((days-1)/365); days = (days-1)%365; }
    let jm = days < 186 ? 1 + Math.floor(days/31) : 7 + Math.floor((days-186)/30);
    let jd = 1 + (days < 186 ? days%31 : (days-186)%30);
    return { jy, jm, jd };
  },

  // Convert Jalali to Gregorian
  fromJalali(jy, jm, jd) {
    const jAccum = [0,31,62,93,124,155,186,216,246,276,306,336];
    let jy1 = jy - 979;
    let days = 365*jy1
      + Math.floor(jy1/33)*8
      + Math.floor(((jy1%33)+3)/4)
      + jAccum[jm-1] + jd - 1;
    days += 79;
    let gy = 1600 + 400 * Math.floor(days/146097);
    days %= 146097;
    let gLeap = true;
    if (days >= 36525) {
      days--;
      gy += 100 * Math.floor(days/36524);
      days %= 36524;
      if (days >= 365) days++;
      else gLeap = false;
    }
    gy += 4 * Math.floor(days/1461);
    days %= 1461;
    if (days >= 366) {
      gLeap = false;
      days--;
      gy += Math.floor(days/365);
      days %= 365;
    }
    const gDays = [31, gLeap?29:28, 31,30,31,30,31,31,30,31,30,31];
    let gm = 0;
    for (; gm < 12 && days >= gDays[gm]; gm++) days -= gDays[gm];
    return { gy, gm: gm+1, gd: days+1 };
  },

  // Get today as Jalali object {jy,jm,jd}
  today() {
    const now = new Date();
    return this.toJalali(now.getFullYear(), now.getMonth()+1, now.getDate());
  },

  // Format as "YYYY/MM/DD"
  format(jy, jm, jd) {
    return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`;
  },

  // Get today formatted
  todayFormatted() {
    const t = this.today();
    return this.format(t.jy, t.jm, t.jd);
  },

  // Parse "YYYY/MM/DD" string → {jy,jm,jd} or null
  parse(str) {
    if (!str) return null;
    const parts = String(str).split('/');
    if (parts.length !== 3) return null;
    const jy = parseInt(parts[0]), jm = parseInt(parts[1]), jd = parseInt(parts[2]);
    if (isNaN(jy)||isNaN(jm)||isNaN(jd)) return null;
    if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
    return { jy, jm, jd };
  },

  isValid(str) {
    return this.parse(str) !== null;
  }
};

window.jalali = jalali;
