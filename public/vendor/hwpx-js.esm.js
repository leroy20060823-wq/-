// node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i2 = 1; i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0; i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0; i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b = fleb[i2];
          add = bits(dat, pos, (1 << b) - 1) + fl[i2];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i2 = 0; i2 < d.length; ++i2) {
    if (d[i2])
      t.push({ s: i2, f: d[i2] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i22 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i22].f ? i0++ : i22++];
    r = t[i0 != i1 && t[i0].f < t[i22].f ? i0++ : i22++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i2 = 1; i2 < s; ++i2) {
    if (t2[i2].s > maxSym)
      maxSym = t2[i2].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i2 = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (; i2 < s; ++i2) {
      var i2_1 = t2[i2].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i2].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i2;
    }
    for (; i2 >= 0 && dt; --i2) {
      var i2_3 = t2[i2].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln = function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i2 = 1; i2 <= s; ++i2) {
    if (c[i2] == cln && i2 != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (; cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (; cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i2];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i2 = 0; i2 < cl.length; ++i2)
    l += cf[i2] * cl[i2];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i2 = 0; i2 < s; ++i2)
    out[o + i2 + 4] = dat[i2];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i2 = 0; i2 < lclt.length; ++i2)
    ++lcfreq[lclt[i2] & 31];
  for (var i2 = 0; i2 < lcdt.length; ++i2)
    ++lcfreq[lcdt[i2] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i2 = 0; i2 < nlcc; ++i2)
      wbits(out, p + 3 * i2, lct[clim[i2]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i2 = 0; i2 < clct.length; ++i2) {
        var len = clct[i2] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i2] >> 5 & 127), p += clct[i2] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i2 = 0; i2 < li; ++i2) {
    var sym = syms[i2];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i3) {
      return (dat[i3] ^ dat[i3 + 1] << bs1_1 ^ dat[i3 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25e3);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i2 = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (; i2 + 2 < s; ++i2) {
      var hv = hsh(i2);
      var imod = i2 & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i2) {
        var rem = s - i2;
        if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i2 - bs, pos);
          li = lc_1 = eb = 0, bs = i2;
          for (var j = 0; j < 286; ++j)
            lf[j] = 0;
          for (var j = 0; j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i2 - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i2);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i2 + l] == dat[i2 + l - dif]) {
              var nl = 0;
              for (; nl < ml && dat[i2 + nl] == dat[i2 + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0; j < mmd; ++j) {
                  var ti = i2 - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i2 + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i2];
          ++lf[dat[i2]];
        }
      }
    }
    for (i2 = Math.max(i2, wi); i2 < s; ++i2) {
      syms[li++] = dat[i2];
      ++lf[dat[i2]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i2 - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i2, st.w = wi;
    }
  } else {
    for (var i2 = st.w || 0; i2 < s + lst; i2 += 65535) {
      var e = i2 + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i2, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
};
var crct = /* @__PURE__ */ (function() {
  var t = new Int32Array(256);
  for (var i2 = 0; i2 < 256; ++i2) {
    var c = i2, k = 9;
    while (--k)
      c = (c & 1 && -306674912) ^ c >>> 1;
    t[i2] = c;
  }
  return t;
})();
var crc = function() {
  var c = -1;
  return {
    p: function(d) {
      var cr = c;
      for (var i2 = 0; i2 < d.length; ++i2)
        cr = crct[cr & 255 ^ d[i2]] ^ cr >>> 8;
      c = cr;
    },
    d: function() {
      return ~c;
    }
  };
};
var dopt = function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
};
var mrg = function(a, b) {
  var o = {};
  for (var k in a)
    o[k] = a[k];
  for (var k in b)
    o[k] = b[k];
  return o;
};
var b2 = function(d, b) {
  return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
};
var wbytes = function(d, b, v) {
  for (; v; ++b)
    d[b] = v, v >>>= 8;
};
function deflateSync(data, opts) {
  return dopt(data, opts || {}, 0, 0);
}
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var fltn = function(d, p, t, o) {
  for (var k in d) {
    var val = d[k], n = p + k, op = o;
    if (Array.isArray(val))
      op = mrg(o, val[1]), val = val[0];
    if (ArrayBuffer.isView(val))
      t[n] = [val, op];
    else {
      t[n += "/"] = [new u8(0), op];
      fltn(val, n, t, o);
    }
  }
};
var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
var dutf8 = function(d) {
  for (var r = "", i2 = 0; ; ) {
    var c = d[i2++];
    var eb = (c > 127) + (c > 223) + (c > 239);
    if (i2 + eb > d.length)
      return { s: r, r: slc(d, i2 - 1) };
    if (!eb)
      r += String.fromCharCode(c);
    else if (eb == 3) {
      c = ((c & 15) << 18 | (d[i2++] & 63) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c & 31) << 6 | d[i2++] & 63);
    else
      r += String.fromCharCode((c & 15) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63);
  }
};
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i2 = 0; i2 < str.length; ++i2)
      ar_1[i2] = str.charCodeAt(i2);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = function(v) {
    ar[ai++] = v;
  };
  for (var i2 = 0; i2 < l; ++i2) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i2 << 1));
      n.set(ar);
      ar = n;
    }
    var c = str.charCodeAt(i2);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
    else
      w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
  }
  return slc(ar, 0, ai);
}
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i2 = 0; i2 < dat.length; i2 += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i2, i2 + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
var slzh = function(d, b) {
  return b + 30 + b2(d, b + 26) + b2(d, b + 28);
};
var zh = function(d, b, z) {
  var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
  var _a2 = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a2[0], su = _a2[1], off = _a2[2];
  return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
};
var z64hs = function(d, b, l, z, sc, su, off) {
  var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
  var nf = nsc + nsu + noff;
  if (z && nf) {
    for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
      if (b2(d, b) == 1) {
        return [
          nsc ? b8(d, b + 4 + 8 * nsu) : sc,
          nsu ? b8(d, b + 4) : su,
          noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
          1
        ];
      }
    }
    if (z < 2)
      err(13);
  }
  return [sc, su, off, 0];
};
var exfl = function(ex) {
  var le = 0;
  if (ex) {
    for (var k in ex) {
      var l = ex[k].length;
      if (l > 65535)
        err(9);
      le += l + 4;
    }
  }
  return le;
};
var wzh = function(d, b, f, fn, u, c, ce, co) {
  var fl2 = fn.length, ex = f.extra, col = co && co.length;
  var exl = exfl(ex);
  wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
  if (ce != null)
    d[b++] = 20, d[b++] = f.os;
  d[b] = 20, b += 2;
  d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
  d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
  var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
  if (y < 0 || y > 119)
    err(10);
  wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
  if (c != -1) {
    wbytes(d, b, f.crc);
    wbytes(d, b + 4, c < 0 ? -c - 2 : c);
    wbytes(d, b + 8, f.size);
  }
  wbytes(d, b + 12, fl2);
  wbytes(d, b + 14, exl), b += 16;
  if (ce != null) {
    wbytes(d, b, col);
    wbytes(d, b + 6, f.attrs);
    wbytes(d, b + 10, ce), b += 14;
  }
  d.set(fn, b);
  b += fl2;
  if (exl) {
    for (var k in ex) {
      var exf = ex[k], l = exf.length;
      wbytes(d, b, +k);
      wbytes(d, b + 2, l);
      d.set(exf, b + 4), b += 4 + l;
    }
  }
  if (col)
    d.set(co, b), b += col;
  return b;
};
var wzf = function(o, b, c, d, e) {
  wbytes(o, b, 101010256);
  wbytes(o, b + 8, c);
  wbytes(o, b + 10, c);
  wbytes(o, b + 12, d);
  wbytes(o, b + 16, e);
};
function zipSync(data, opts) {
  if (!opts)
    opts = {};
  var r = {};
  var files = [];
  fltn(data, "", r, opts);
  var o = 0;
  var tot = 0;
  for (var fn in r) {
    var _a2 = r[fn], file = _a2[0], p = _a2[1];
    var compression = p.level == 0 ? 0 : 8;
    var f = strToU8(fn), s = f.length;
    var com = p.comment, m = com && strToU8(com), ms = m && m.length;
    var exl = exfl(p.extra);
    if (s > 65535)
      err(11);
    var d = compression ? deflateSync(file, p) : file, l = d.length;
    var c = crc();
    c.p(file);
    files.push(mrg(p, {
      size: file.length,
      crc: c.d(),
      c: d,
      f,
      m,
      u: s != fn.length || m && com.length != ms,
      o,
      compression
    }));
    o += 30 + s + exl + l;
    tot += 76 + 2 * (s + exl) + (ms || 0) + l;
  }
  var out = new u8(tot + 22), oe = o, cdl = tot - o;
  for (var i2 = 0; i2 < files.length; ++i2) {
    var f = files[i2];
    wzh(out, f.o, f, f.f, f.u, f.c.length);
    var badd = 30 + f.f.length + exfl(f.extra);
    out.set(f.c, f.o + badd);
    wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
  }
  wzf(out, o, files.length, cdl, oe);
  return out;
}
function unzipSync(data, opts) {
  var files = {};
  var e = data.length - 22;
  for (; b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558)
      err(13);
  }
  ;
  var c = b2(data, e + 8);
  if (!c)
    return {};
  var o = b4(data, e + 16);
  var z = b4(data, e - 20) == 117853008;
  if (z) {
    var ze = b4(data, e - 12);
    z = b4(data, ze) == 101075792;
    if (z) {
      c = b4(data, ze + 32);
      o = b4(data, ze + 48);
    }
  }
  var fltr = opts && opts.filter;
  for (var i2 = 0; i2 < c; ++i2) {
    var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
    o = no;
    if (!fltr || fltr({
      name: fn,
      size: sc,
      originalSize: su,
      compression: c_2
    })) {
      if (!c_2)
        files[fn] = slc(data, b, b + sc);
      else if (c_2 == 8)
        files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
      else
        err(14, "unknown compression type " + c_2);
    }
  }
  return files;
}

// node_modules/hwpx-js/dist/index.js
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
function createZip(entries) {
  const data = {};
  for (const entry of entries) {
    data[entry.path] = entry.store ? [entry.data, { level: 0 }] : entry.data;
  }
  return zipSync(data);
}
function extractZip(data) {
  return unzipSync(data);
}
function encodeUtf8(str) {
  return new TextEncoder().encode(str);
}
function decodeUtf8(data) {
  return new TextDecoder().decode(data);
}
function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function attrs(map) {
  const parts = [];
  for (const [key, val] of Object.entries(map)) {
    if (val === void 0) continue;
    parts.push(`${key}="${escapeXml(String(val))}"`);
  }
  return parts.length > 0 ? " " + parts.join(" ") : "";
}
function el(tag, attributes, children) {
  const a = attrs(attributes);
  if (children === void 0 || children === "") {
    return `<${tag}${a}/>`;
  }
  return `<${tag}${a}>${children}</${tag}>`;
}
function xmlDecl() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
}
var NS = {
  // 한/글 문서 네임스페이스
  hh: "http://www.hancom.co.kr/hwpml/2011/head",
  hp: "http://www.hancom.co.kr/hwpml/2011/paragraph",
  hs: "http://www.hancom.co.kr/hwpml/2011/section",
  hc: "http://www.hancom.co.kr/hwpml/2011/core",
  ha: "http://www.hancom.co.kr/hwpml/2011/app",
  // OPF / ODF
  opf: "http://www.idpf.org/2007/opf",
  odf: "urn:oasis:names:tc:opendocument:xmlns:container",
  // 미디어 타입
  mimeHwpx: "application/hwp+zip"
};
function generateVersionXml(meta) {
  return xmlDecl() + "\n" + el(
    "hc:version",
    {
      "xmlns:hc": NS.hc,
      "xmlns:ha": NS.ha,
      tagtypes: "1"
    },
    "\n" + el("ha:app", {}, "hwpx-js") + "\n" + el("ha:appversion", {}, meta.hwpVersion) + "\n" + el(
      "hc:version",
      { tagtypes: "0" },
      el("ha:major", {}, "1") + el("ha:minor", {}, "4")
    ) + "\n"
  );
}
function generateContainerXml() {
  return xmlDecl() + "\n" + el(
    "container",
    { xmlns: NS.odf, version: "1.0" },
    "\n" + el(
      "rootfiles",
      {},
      "\n" + el("rootfile", {
        "full-path": "Contents/content.hpf",
        "media-type": NS.mimeHwpx
      }) + "\n"
    ) + "\n"
  );
}
function generateManifestXml(entries) {
  const items = entries.map(
    (e) => "\n" + el("manifest:file-entry", {
      "manifest:full-path": e.fullPath,
      "manifest:media-type": e.mediaType
    })
  ).join("");
  return xmlDecl() + "\n" + el(
    "manifest:manifest",
    { "xmlns:manifest": "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" },
    items + "\n"
  );
}
function buildManifestEntries(sectionCount, binData) {
  const entries = [
    { fullPath: "/", mediaType: "application/hwp+zip" },
    { fullPath: "version.xml", mediaType: "application/xml" },
    { fullPath: "Contents/content.hpf", mediaType: "application/xml" },
    { fullPath: "Contents/header.xml", mediaType: "application/xml" },
    { fullPath: "settings.xml", mediaType: "application/xml" }
  ];
  for (let i2 = 0; i2 < sectionCount; i2++) {
    entries.push({
      fullPath: `Contents/section${i2}.xml`,
      mediaType: "application/xml"
    });
  }
  for (const bin of binData) {
    const mimeMap = {
      jpg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      bmp: "image/bmp",
      tiff: "image/tiff",
      wmf: "image/x-wmf",
      emf: "image/x-emf"
    };
    entries.push({
      fullPath: `BinData/${bin.name}`,
      mediaType: mimeMap[bin.format] || "application/octet-stream"
    });
  }
  return entries;
}
function generateSettingsXml() {
  return xmlDecl() + "\n" + el(
    "ha:HWPApplicationSetting",
    { "xmlns:ha": NS.ha },
    "\n" + el("ha:CaretPosition", { list: "0", para: "0", pos: "0" }) + "\n"
  );
}
function generateContentHpfXml(doc) {
  const sectionItems = doc.sections.map(
    (_, i2) => el("opf:item", {
      id: `section${i2}`,
      href: `section${i2}.xml`,
      "media-type": "application/xml"
    })
  ).join("\n");
  const sectionRefs = doc.sections.map((_, i2) => el("opf:itemref", { idref: `section${i2}` })).join("\n");
  const binItems = doc.binData.map(
    (b) => el("opf:item", {
      id: `bindata${b.id}`,
      href: `../BinData/${b.name}`,
      "media-type": getMimeType(b.format)
    })
  ).join("\n");
  return xmlDecl() + "\n" + el(
    "opf:package",
    {
      "xmlns:opf": NS.opf,
      version: "1.0",
      "unique-identifier": "bookid"
    },
    "\n" + el(
      "opf:metadata",
      {},
      "\n" + el("opf:title", {}, doc.meta.title || "") + "\n"
    ) + "\n" + el(
      "opf:manifest",
      {},
      "\n" + el("opf:item", { id: "header", href: "header.xml", "media-type": "application/xml" }) + "\n" + sectionItems + "\n" + binItems + (binItems ? "\n" : "")
    ) + "\n" + el(
      "opf:spine",
      {},
      "\n" + sectionRefs + "\n"
    ) + "\n"
  );
}
function getMimeType(format) {
  const map = {
    jpg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    bmp: "image/bmp",
    tiff: "image/tiff",
    wmf: "image/x-wmf",
    emf: "image/x-emf"
  };
  return map[format] || "application/octet-stream";
}
function generateHeaderXml(head) {
  return xmlDecl() + "\n" + el(
    "hh:head",
    {
      "xmlns:hh": NS.hh,
      "xmlns:hc": NS.hc,
      version: "1.4",
      secCnt: "1"
    },
    "\n" + generateFontFaces(head.fontFaces) + generateBorderFills(head.borderFills) + generateCharProperties(head.charProperties) + generateParaProperties(head.paraProperties) + generateStyles(head.styles) + generateNumberings(head.numberingProperties) + generateBullets(head.bulletProperties) + generateCompatibleDoc(head.compatibleDoc)
  );
}
function generateFontFaces(faces) {
  if (faces.length === 0) return "";
  const byLang = /* @__PURE__ */ new Map();
  for (const f of faces) {
    const arr = byLang.get(f.lang) || [];
    arr.push(f);
    byLang.set(f.lang, arr);
  }
  let xml = "";
  xml += el(
    "hh:fontfaces",
    {},
    "\n" + Array.from(byLang.entries()).map(
      ([lang, items]) => el(
        "hh:fontface",
        { lang },
        "\n" + items.map(
          (f, i2) => el("hh:font", { id: String(i2), face: f.fontName, type: f.fontType || "ttf" })
        ).join("\n") + "\n"
      )
    ).join("\n") + "\n"
  );
  xml += "\n";
  return xml;
}
function generateBorderFills(fills) {
  if (fills.length === 0) return "";
  const items = fills.map((bf) => {
    const borderElements = ["left", "right", "top", "bottom"].map((side) => generateBorderLine(side, bf.borders[side])).join("\n");
    let fillContent = "";
    if (bf.fillBrush) {
      if (bf.fillBrush.type === "SOLID" && bf.fillBrush.faceColor !== void 0) {
        fillContent = el(
          "hc:fillBrush",
          {},
          "\n" + el("hc:winBrush", {
            faceColor: colorToString(bf.fillBrush.faceColor),
            hatchColor: bf.fillBrush.patternColor !== void 0 ? colorToString(bf.fillBrush.patternColor) : void 0
          }) + "\n"
        );
      }
    }
    return el(
      "hh:borderFill",
      {
        id: String(bf.id),
        threeD: bf.threeD ? "1" : "0",
        shadow: bf.shadow ? "1" : "0",
        slash: bf.slash || "NONE",
        backSlash: bf.backSlash || "NONE"
      },
      "\n" + borderElements + "\n" + fillContent
    );
  });
  return el("hh:borderFills", {}, "\n" + items.join("\n") + "\n") + "\n";
}
function generateBorderLine(side, line) {
  return el(`hc:${side}Border`, {
    type: line.type,
    width: line.width,
    color: colorToString(line.color)
  });
}
function generateCharProperties(props) {
  if (props.length === 0) return "";
  const items = props.map((cp) => {
    const fontRefs = el("hh:fontRef", {
      hangul: String(cp.fontRef.hangul),
      latin: String(cp.fontRef.latin),
      hanja: String(cp.fontRef.hanja),
      japanese: String(cp.fontRef.japanese),
      other: String(cp.fontRef.other),
      symbol: String(cp.fontRef.symbol),
      user: String(cp.fontRef.user)
    });
    return el(
      "hh:charPr",
      {
        id: String(cp.id),
        height: String(cp.height),
        textColor: colorToString(cp.textColor),
        shadeColor: cp.shadeColor !== void 0 ? colorToString(cp.shadeColor) : void 0,
        useFontSpace: cp.useFontSpace ? "1" : void 0,
        useKerning: cp.useKerning ? "1" : void 0,
        spacing: cp.spacing !== void 0 ? String(cp.spacing) : void 0,
        relSz: cp.relSize !== void 0 ? String(cp.relSize) : void 0,
        offset: cp.charOffset !== void 0 ? String(cp.charOffset) : void 0,
        bold: cp.bold ? "1" : "0",
        italic: cp.italic ? "1" : "0",
        underline: cp.underline || "NONE",
        strikeout: cp.strikeout || "NONE"
      },
      "\n" + fontRefs + "\n"
    );
  });
  return el("hh:charProperties", {}, "\n" + items.join("\n") + "\n") + "\n";
}
function generateParaProperties(props) {
  if (props.length === 0) return "";
  const items = props.map((pp) => {
    const marginEl = el("hh:parMargin", {
      left: String(pp.paraMargin.left),
      right: String(pp.paraMargin.right),
      indent: String(pp.paraMargin.indent),
      prev: String(pp.paraMargin.prevSpacing),
      next: String(pp.paraMargin.nextSpacing)
    });
    const lineSpacingEl = el("hh:lineSpacing", {
      type: pp.lineSpacing.type,
      value: String(pp.lineSpacing.value)
    });
    return el(
      "hh:paraPr",
      {
        id: String(pp.id),
        align: pp.alignment || "JUSTIFY",
        heading: pp.heading,
        breakBefore: pp.breakBefore
      },
      "\n" + marginEl + "\n" + lineSpacingEl + "\n"
    );
  });
  return el("hh:paraProperties", {}, "\n" + items.join("\n") + "\n") + "\n";
}
function generateStyles(styles) {
  if (styles.length === 0) return "";
  const items = styles.map(
    (s) => el("hh:style", {
      id: String(s.id),
      type: s.type,
      name: s.name,
      engName: s.engName,
      paraPrIDRef: s.paraPrIDRef !== void 0 ? String(s.paraPrIDRef) : void 0,
      charPrIDRef: s.charPrIDRef !== void 0 ? String(s.charPrIDRef) : void 0,
      nextStyleIDRef: s.nextStyleIDRef !== void 0 ? String(s.nextStyleIDRef) : void 0
    })
  );
  return el("hh:styles", {}, "\n" + items.join("\n") + "\n") + "\n";
}
function generateNumberings(numberings) {
  if (numberings.length === 0) return "";
  const items = numberings.map((n) => {
    const levels = n.levels.map(
      (lvl, i2) => el("hh:paraHead", {
        level: String(i2 + 1),
        numFormat: lvl.format,
        start: lvl.start !== void 0 ? String(lvl.start) : "1",
        prefix: lvl.prefix || "",
        suffix: lvl.suffix || "."
      })
    ).join("\n");
    return el("hh:numbering", { id: String(n.id) }, "\n" + levels + "\n");
  });
  return el("hh:numberings", {}, "\n" + items.join("\n") + "\n") + "\n";
}
function generateBullets(bullets) {
  if (bullets.length === 0) return "";
  const items = bullets.map(
    (b) => el("hh:bullet", {
      id: String(b.id),
      char: b.bulletChar,
      bulletSz: b.bulletSize !== void 0 ? String(b.bulletSize) : void 0
    })
  );
  return el("hh:bullets", {}, "\n" + items.join("\n") + "\n") + "\n";
}
function generateCompatibleDoc(compat) {
  if (!compat) return "";
  return el("hh:compatibleDocument", { targetProgram: compat }) + "\n";
}
function colorToString(color) {
  return "#" + color.toString(16).padStart(6, "0");
}
function generateSectionXml(section, sectionIndex) {
  return xmlDecl() + "\n" + el(
    "hs:sec",
    {
      "xmlns:hs": NS.hs,
      "xmlns:hp": NS.hp,
      "xmlns:hc": NS.hc
    },
    "\n" + generateSectionDef(section.def) + section.paragraphs.map((p) => generateParagraph(p)).join("\n") + "\n"
  );
}
function generateSectionDef(def) {
  const pagePr = el("hs:pagePr", {
    landscape: def.landscape ? "LANDSCAPE" : "PORTRAIT",
    width: String(def.pageWidth),
    height: String(def.pageHeight),
    gutterType: def.gutterType || "LEFT_ONLY"
  });
  const pageMargin = el("hs:pageMargin", {
    left: String(def.pageMargin.left),
    right: String(def.pageMargin.right),
    top: String(def.pageMargin.top),
    bottom: String(def.pageMargin.bottom),
    header: String(def.pageMargin.header),
    footer: String(def.pageMargin.footer),
    gutter: String(def.pageMargin.gutter)
  });
  let extra = "";
  if (def.columns && def.columns.count > 1) {
    extra += generateColumns(def.columns) + "\n";
  }
  if (def.headerFooter) {
    if (def.headerFooter.header) {
      extra += generateHeaderFooter("hs:header", def.headerFooter.header) + "\n";
    }
    if (def.headerFooter.footer) {
      extra += generateHeaderFooter("hs:footer", def.headerFooter.footer) + "\n";
    }
  }
  return el(
    "hs:secPr",
    {},
    "\n" + pagePr + "\n" + pageMargin + "\n" + extra
  ) + "\n";
}
function generateColumns(cols) {
  return el("hs:colPr", {
    type: cols.type || "NORMAL",
    count: String(cols.count),
    gap: String(cols.gap || 0),
    sameSz: cols.sameSizes ? "1" : "0"
  });
}
function generateHeaderFooter(tag, subDoc) {
  const paragraphs = subDoc.paragraphs.map((p) => generateParagraph(p)).join("\n");
  return el(tag, {}, "\n" + paragraphs + "\n");
}
function generateParagraph(para) {
  const runs = para.runs.map((run) => generateRun(run)).join("");
  return el(
    "hp:p",
    {
      paraPrIDRef: String(para.paraPrIDRef),
      styleIDRef: String(para.styleIDRef)
    },
    "\n" + runs
  );
}
function generateRun(run) {
  switch (run.t) {
    case "text":
      return generateTextRun(run);
    case "table":
      return generateTableRun(run);
    case "picture":
      return generatePictureRun(run);
    case "break":
      return generateBreakRun(run);
    default:
      return "";
  }
}
function generateTextRun(run) {
  return el(
    "hp:run",
    { charPrIDRef: String(run.charPrIDRef) },
    "\n" + el("hp:runText", {}, escapeXml(run.text)) + "\n"
  );
}
function generateTableRun(run) {
  return el(
    "hp:run",
    { charPrIDRef: String(run.charPrIDRef) },
    "\n" + generateTable(run.table) + "\n"
  );
}
function generatePictureRun(run) {
  return el(
    "hp:run",
    { charPrIDRef: String(run.charPrIDRef) },
    "\n" + generatePicture(run.picture) + "\n"
  );
}
function generateBreakRun(run) {
  const tagMap = {
    LINE: "hp:lineBreak",
    PAGE: "hp:pageBreak",
    COLUMN: "hp:colBreak"
  };
  const tag = tagMap[run.breakType] || "hp:lineBreak";
  return el(
    "hp:run",
    { charPrIDRef: String(run.charPrIDRef) },
    `
<${tag}/>
`
  );
}
function generateTable(table) {
  const colWidths = table.colWidths.map((w) => el("hp:colSz", { width: String(w) })).join("\n");
  const rows = table.rows.map((row, ri) => generateTableRow(row, ri)).join("\n");
  return el(
    "hp:tbl",
    {
      rowCnt: String(table.rowCount),
      colCnt: String(table.colCount),
      cellSpacing: table.cellSpacing !== void 0 ? String(table.cellSpacing) : "0",
      borderFillIDRef: String(table.borderFillIDRef),
      width: String(table.width)
    },
    "\n" + colWidths + "\n" + rows + "\n"
  );
}
function generateTableRow(row, rowIndex) {
  const cells = row.cells.map((cell) => generateTableCell(cell)).join("\n");
  return el(
    "hp:tr",
    { height: String(row.height) },
    "\n" + cells + "\n"
  );
}
function generateTableCell(cell) {
  const paddingAttrs = {};
  if (cell.padding) {
    paddingAttrs["paddingLeft"] = String(cell.padding.left);
    paddingAttrs["paddingRight"] = String(cell.padding.right);
    paddingAttrs["paddingTop"] = String(cell.padding.top);
    paddingAttrs["paddingBottom"] = String(cell.padding.bottom);
  }
  const paragraphs = cell.paragraphs.map((p) => generateParagraph(p)).join("\n");
  return el(
    "hp:tc",
    {
      colSpan: String(cell.colSpan),
      rowSpan: String(cell.rowSpan),
      width: String(cell.width),
      height: String(cell.height),
      borderFillIDRef: String(cell.borderFillIDRef),
      ...paddingAttrs
    },
    "\n" + el("hp:subList", {}, "\n" + paragraphs + "\n") + "\n"
  );
}
function generatePicture(pic) {
  return el(
    "hp:pic",
    {
      binDataIDRef: String(pic.binDataIDRef),
      width: String(pic.width),
      height: String(pic.height),
      offsetX: pic.offsetX !== void 0 ? String(pic.offsetX) : void 0,
      offsetY: pic.offsetY !== void 0 ? String(pic.offsetY) : void 0
    }
  );
}
function writeHwpx(doc, _opts) {
  const entries = [];
  entries.push({
    path: "mimetype",
    data: encodeUtf8(NS.mimeHwpx),
    store: true
  });
  entries.push({
    path: "META-INF/container.xml",
    data: encodeUtf8(generateContainerXml())
  });
  const manifestEntries = buildManifestEntries(
    doc.sections.length,
    doc.binData.map((b) => ({ name: b.name, format: b.format }))
  );
  entries.push({
    path: "META-INF/manifest.xml",
    data: encodeUtf8(generateManifestXml(manifestEntries))
  });
  entries.push({
    path: "version.xml",
    data: encodeUtf8(generateVersionXml(doc.meta))
  });
  entries.push({
    path: "settings.xml",
    data: encodeUtf8(generateSettingsXml())
  });
  entries.push({
    path: "Contents/content.hpf",
    data: encodeUtf8(generateContentHpfXml(doc))
  });
  entries.push({
    path: "Contents/header.xml",
    data: encodeUtf8(generateHeaderXml(doc.head))
  });
  for (let i2 = 0; i2 < doc.sections.length; i2++) {
    entries.push({
      path: `Contents/section${i2}.xml`,
      data: encodeUtf8(generateSectionXml(doc.sections[i2], i2))
    });
  }
  for (const bin of doc.binData) {
    entries.push({
      path: `BinData/${bin.name}`,
      data: bin.data
    });
  }
  return createZip(entries);
}
function parseXml(xml) {
  const parser = new XmlParser(xml);
  return parser.parse();
}
function findChild(node, tag) {
  return node.children.find((c) => c.tag === tag || stripNs(c.tag) === tag);
}
function findChildren(node, tag) {
  return node.children.filter((c) => c.tag === tag || stripNs(c.tag) === tag);
}
function stripNs(tag) {
  const idx = tag.indexOf(":");
  return idx >= 0 ? tag.substring(idx + 1) : tag;
}
function attrInt(node, name, defaultValue = 0) {
  const v = node.attrs[name];
  if (v === void 0) return defaultValue;
  const n = parseInt(v, 10);
  return isNaN(n) ? defaultValue : n;
}
function attrStr(node, name, defaultValue = "") {
  return node.attrs[name] ?? defaultValue;
}
function attrBool(node, name, defaultValue = false) {
  const v = node.attrs[name];
  if (v === void 0) return defaultValue;
  return v === "1" || v === "true";
}
var XmlParser = class {
  constructor(xml) {
    this.xml = xml;
    this.pos = 0;
  }
  parse() {
    this.skipWhitespace();
    if (this.xml.startsWith("<?", this.pos)) {
      const end = this.xml.indexOf("?>", this.pos);
      if (end >= 0) this.pos = end + 2;
    }
    this.skipWhitespace();
    return this.parseElement();
  }
  parseElement() {
    this.expect("<");
    const tag = this.readTagName();
    const attrs3 = this.readAttributes();
    this.skipWhitespace();
    if (this.xml.startsWith("/>", this.pos)) {
      this.pos += 2;
      return { tag, attrs: attrs3, children: [], text: "" };
    }
    this.expect(">");
    const children = [];
    let text = "";
    let hasChildElements = false;
    while (this.pos < this.xml.length) {
      if (this.xml.startsWith("</", this.pos)) {
        this.pos += 2;
        const closingTag = this.readTagName();
        this.skipWhitespace();
        this.expect(">");
        const finalText2 = hasChildElements ? text.trim() : text;
        return { tag, attrs: attrs3, children, text: finalText2 };
      }
      if (this.xml.startsWith("<!--", this.pos)) {
        const end = this.xml.indexOf("-->", this.pos);
        if (end >= 0) this.pos = end + 3;
        continue;
      }
      if (this.xml.startsWith("<![CDATA[", this.pos)) {
        const end = this.xml.indexOf("]]>", this.pos);
        if (end >= 0) {
          text += this.xml.substring(this.pos + 9, end);
          this.pos = end + 3;
        }
        continue;
      }
      if (this.xml[this.pos] === "<") {
        hasChildElements = true;
        children.push(this.parseElement());
      } else {
        const nextTag = this.xml.indexOf("<", this.pos);
        if (nextTag >= 0) {
          text += this.xml.substring(this.pos, nextTag);
          this.pos = nextTag;
        } else {
          text += this.xml.substring(this.pos);
          this.pos = this.xml.length;
        }
      }
    }
    const finalText = hasChildElements ? text.trim() : text;
    return { tag, attrs: attrs3, children, text: finalText };
  }
  readTagName() {
    const start = this.pos;
    while (this.pos < this.xml.length) {
      const ch = this.xml[this.pos];
      if (ch === " " || ch === "	" || ch === "\n" || ch === "\r" || ch === ">" || ch === "/") break;
      this.pos++;
    }
    return this.xml.substring(start, this.pos);
  }
  readAttributes() {
    const attrs3 = {};
    while (this.pos < this.xml.length) {
      this.skipWhitespace();
      const ch = this.xml[this.pos];
      if (ch === ">" || ch === "/") break;
      const name = this.readAttrName();
      this.skipWhitespace();
      this.expect("=");
      this.skipWhitespace();
      const value = this.readAttrValue();
      attrs3[name] = this.unescapeXml(value);
    }
    return attrs3;
  }
  readAttrName() {
    const start = this.pos;
    while (this.pos < this.xml.length) {
      const ch = this.xml[this.pos];
      if (ch === "=" || ch === " " || ch === "	" || ch === "\n" || ch === ">" || ch === "/") break;
      this.pos++;
    }
    return this.xml.substring(start, this.pos);
  }
  readAttrValue() {
    const quote = this.xml[this.pos];
    if (quote !== '"' && quote !== "'") {
      throw new Error(`Expected quote at pos ${this.pos}`);
    }
    this.pos++;
    const start = this.pos;
    const end = this.xml.indexOf(quote, this.pos);
    if (end < 0) throw new Error(`Unterminated attribute value at pos ${start}`);
    this.pos = end + 1;
    return this.xml.substring(start, end);
  }
  skipWhitespace() {
    while (this.pos < this.xml.length) {
      const ch = this.xml[this.pos];
      if (ch !== " " && ch !== "	" && ch !== "\n" && ch !== "\r") break;
      this.pos++;
    }
  }
  expect(ch) {
    if (!this.xml.startsWith(ch, this.pos)) {
      throw new Error(
        `Expected "${ch}" at pos ${this.pos}, got "${this.xml.substring(this.pos, this.pos + 10)}"`
      );
    }
    this.pos += ch.length;
  }
  unescapeXml(str) {
    return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }
};
function parseHeaderXml(xml) {
  const root = parseXml(xml);
  const refList = findChild(root, "hh:refList") || root;
  return {
    fontFaces: parseFontFaces(refList),
    borderFills: parseBorderFills(refList),
    charProperties: parseCharProperties(refList),
    paraProperties: parseParaProperties(refList),
    styles: parseStyles(refList),
    bulletProperties: parseBullets(refList),
    numberingProperties: parseNumberings(refList),
    compatibleDoc: parseCompatibleDoc(root)
  };
}
function parseFontFaces(root) {
  const faces = [];
  const fontfacesNode = findChild(root, "hh:fontfaces");
  if (!fontfacesNode) return faces;
  for (const faceNode of findChildren(fontfacesNode, "hh:fontface")) {
    const lang = attrStr(faceNode, "lang", "HANGUL");
    for (const fontNode of findChildren(faceNode, "hh:font")) {
      faces.push({
        lang,
        fontName: attrStr(fontNode, "face"),
        fontType: attrStr(fontNode, "type", "ttf")
      });
    }
  }
  return faces;
}
function parseBorderFills(root) {
  const fills = [];
  const fillsNode = findChild(root, "hh:borderFills");
  if (!fillsNode) return fills;
  for (const bfNode of findChildren(fillsNode, "hh:borderFill")) {
    const leftBorder = findChild(bfNode, "hc:leftBorder");
    const rightBorder = findChild(bfNode, "hc:rightBorder");
    const topBorder = findChild(bfNode, "hc:topBorder");
    const bottomBorder = findChild(bfNode, "hc:bottomBorder");
    let fillBrush;
    const fillBrushNode = findChild(bfNode, "hc:fillBrush");
    if (fillBrushNode) {
      const winBrush = findChild(fillBrushNode, "hc:winBrush");
      if (winBrush) {
        fillBrush = {
          type: "SOLID",
          faceColor: parseColor(attrStr(winBrush, "faceColor", "#000000")),
          patternColor: winBrush.attrs["hatchColor"] ? parseColor(attrStr(winBrush, "hatchColor")) : void 0
        };
      }
    }
    fills.push({
      id: attrInt(bfNode, "id"),
      threeD: attrBool(bfNode, "threeD"),
      shadow: attrBool(bfNode, "shadow"),
      slash: attrStr(bfNode, "slash", "NONE"),
      backSlash: attrStr(bfNode, "backSlash", "NONE"),
      borders: {
        left: parseBorderLine(leftBorder),
        right: parseBorderLine(rightBorder),
        top: parseBorderLine(topBorder),
        bottom: parseBorderLine(bottomBorder)
      },
      fillBrush
    });
  }
  return fills;
}
function parseBorderLine(node) {
  if (!node) {
    return { type: "NONE", width: "0.1mm", color: 0 };
  }
  return {
    type: attrStr(node, "type", "NONE"),
    width: attrStr(node, "width", "0.1mm"),
    color: parseColor(attrStr(node, "color", "#000000"))
  };
}
function parseCharProperties(root) {
  const props = [];
  const propsNode = findChild(root, "hh:charProperties");
  if (!propsNode) return props;
  for (const cpNode of findChildren(propsNode, "hh:charPr")) {
    const fontRefNode = findChild(cpNode, "hh:fontRef");
    const hasBoldElement = !!findChild(cpNode, "hh:bold");
    const hasItalicElement = !!findChild(cpNode, "hh:italic");
    const underlineNode = findChild(cpNode, "hh:underline");
    const strikeoutNode = findChild(cpNode, "hh:strikeout");
    const underline = underlineNode ? attrStr(underlineNode, "type", "NONE") : attrStr(cpNode, "underline", "NONE");
    const strikeout = strikeoutNode ? attrStr(strikeoutNode, "shape", "NONE") === "NONE" ? "NONE" : "CONTINUOUS" : attrStr(cpNode, "strikeout", "NONE");
    props.push({
      id: attrInt(cpNode, "id"),
      height: attrInt(cpNode, "height", 1e3),
      textColor: parseColor(attrStr(cpNode, "textColor", "#000000")),
      shadeColor: cpNode.attrs["shadeColor"] && cpNode.attrs["shadeColor"] !== "none" ? parseColor(attrStr(cpNode, "shadeColor")) : void 0,
      bold: hasBoldElement || attrBool(cpNode, "bold"),
      italic: hasItalicElement || attrBool(cpNode, "italic"),
      underline,
      strikeout,
      useFontSpace: attrBool(cpNode, "useFontSpace"),
      useKerning: attrBool(cpNode, "useKerning"),
      spacing: cpNode.attrs["spacing"] !== void 0 ? attrInt(cpNode, "spacing") : void 0,
      relSize: cpNode.attrs["relSz"] !== void 0 ? attrInt(cpNode, "relSz") : void 0,
      charOffset: cpNode.attrs["offset"] !== void 0 ? attrInt(cpNode, "offset") : void 0,
      fontRef: fontRefNode ? {
        hangul: attrInt(fontRefNode, "hangul"),
        latin: attrInt(fontRefNode, "latin"),
        hanja: attrInt(fontRefNode, "hanja"),
        japanese: attrInt(fontRefNode, "japanese"),
        other: attrInt(fontRefNode, "other"),
        symbol: attrInt(fontRefNode, "symbol"),
        user: attrInt(fontRefNode, "user")
      } : { hangul: 0, latin: 0, hanja: 0, japanese: 0, other: 0, symbol: 0, user: 0 }
    });
  }
  return props;
}
function parseParaProperties(root) {
  const props = [];
  const propsNode = findChild(root, "hh:paraProperties");
  if (!propsNode) return props;
  for (const ppNode of findChildren(propsNode, "hh:paraPr")) {
    const alignNode = findChild(ppNode, "hh:align");
    const alignment = alignNode ? attrStr(alignNode, "horizontal", "JUSTIFY") : attrStr(ppNode, "align", "JUSTIFY");
    let marginNode = findChild(ppNode, "hh:parMargin") || findChild(ppNode, "hh:margin");
    let lineSpacingNode = findChild(ppNode, "hh:lineSpacing");
    const switchNode = findChild(ppNode, "hp:switch");
    if (switchNode) {
      const caseNode = findChild(switchNode, "hp:case");
      if (caseNode) {
        if (!marginNode) marginNode = findChild(caseNode, "hh:margin");
        if (!lineSpacingNode) lineSpacingNode = findChild(caseNode, "hh:lineSpacing");
      }
    }
    let paraMargin = { left: 0, right: 0, indent: 0, prevSpacing: 0, nextSpacing: 0 };
    if (marginNode) {
      const leftChild = findChild(marginNode, "hc:left");
      if (leftChild) {
        const intentChild = findChild(marginNode, "hc:intent");
        const rightChild = findChild(marginNode, "hc:right");
        const prevChild = findChild(marginNode, "hc:prev");
        const nextChild = findChild(marginNode, "hc:next");
        paraMargin = {
          left: leftChild ? attrInt(leftChild, "value") : 0,
          right: rightChild ? attrInt(rightChild, "value") : 0,
          indent: intentChild ? attrInt(intentChild, "value") : 0,
          prevSpacing: prevChild ? attrInt(prevChild, "value") : 0,
          nextSpacing: nextChild ? attrInt(nextChild, "value") : 0
        };
      } else {
        paraMargin = {
          left: attrInt(marginNode, "left"),
          right: attrInt(marginNode, "right"),
          indent: attrInt(marginNode, "indent"),
          prevSpacing: attrInt(marginNode, "prev"),
          nextSpacing: attrInt(marginNode, "next")
        };
      }
    }
    const headingNode = findChild(ppNode, "hh:heading");
    props.push({
      id: attrInt(ppNode, "id"),
      alignment,
      heading: headingNode ? attrStr(headingNode, "type", "NONE") : ppNode.attrs["heading"] ? ppNode.attrs["heading"] : void 0,
      breakBefore: ppNode.attrs["breakBefore"] ? ppNode.attrs["breakBefore"] : void 0,
      lineSpacing: lineSpacingNode ? {
        type: attrStr(lineSpacingNode, "type", "PERCENT"),
        value: attrInt(lineSpacingNode, "value", 160)
      } : { type: "PERCENT", value: 160 },
      paraMargin
    });
  }
  return props;
}
function parseStyles(root) {
  const styles = [];
  const stylesNode = findChild(root, "hh:styles");
  if (!stylesNode) return styles;
  for (const sNode of findChildren(stylesNode, "hh:style")) {
    styles.push({
      id: attrInt(sNode, "id"),
      type: attrStr(sNode, "type", "PARA"),
      name: attrStr(sNode, "name"),
      engName: sNode.attrs["engName"] || void 0,
      paraPrIDRef: sNode.attrs["paraPrIDRef"] !== void 0 ? attrInt(sNode, "paraPrIDRef") : void 0,
      charPrIDRef: sNode.attrs["charPrIDRef"] !== void 0 ? attrInt(sNode, "charPrIDRef") : void 0,
      nextStyleIDRef: sNode.attrs["nextStyleIDRef"] !== void 0 ? attrInt(sNode, "nextStyleIDRef") : void 0
    });
  }
  return styles;
}
function parseNumberings(root) {
  const result = [];
  const node = findChild(root, "hh:numberings");
  if (!node) return result;
  for (const nNode of findChildren(node, "hh:numbering")) {
    const levels = [];
    for (const lNode of findChildren(nNode, "hh:paraHead")) {
      levels.push({
        format: attrStr(lNode, "numFormat", "DIGIT"),
        start: attrInt(lNode, "start", 1),
        prefix: lNode.attrs["prefix"] || void 0,
        suffix: lNode.attrs["suffix"] || void 0
      });
    }
    result.push({ id: attrInt(nNode, "id"), levels });
  }
  return result;
}
function parseBullets(root) {
  const result = [];
  const node = findChild(root, "hh:bullets");
  if (!node) return result;
  for (const bNode of findChildren(node, "hh:bullet")) {
    result.push({
      id: attrInt(bNode, "id"),
      bulletChar: attrStr(bNode, "char", "\u25CF"),
      bulletSize: bNode.attrs["bulletSz"] !== void 0 ? attrInt(bNode, "bulletSz") : void 0
    });
  }
  return result;
}
function parseCompatibleDoc(root) {
  const node = findChild(root, "hh:compatibleDocument");
  if (!node) return void 0;
  return attrStr(node, "targetProgram") || void 0;
}
function parseColor(hex) {
  const h = hex.replace("#", "");
  return parseInt(h, 16);
}
function parseSectionXml(xml) {
  const root = parseXml(xml);
  return {
    def: parseSectionDef(root),
    paragraphs: parseParagraphs(root)
  };
}
function parseSectionDef(root) {
  let secPr = findChild(root, "hs:secPr");
  if (!secPr) {
    for (const p of findChildren(root, "hp:p")) {
      for (const run of findChildren(p, "hp:run")) {
        const found = findChild(run, "hp:secPr");
        if (found) {
          secPr = found;
          break;
        }
      }
      if (secPr) break;
    }
  }
  if (!secPr) {
    return defaultSectionDef();
  }
  const pagePr = findChild(secPr, "hp:pagePr") || findChild(secPr, "hs:pagePr");
  const pageMarginNode = findChild(secPr, "hs:pageMargin") || (pagePr ? findChild(pagePr, "hp:margin") || findChild(pagePr, "hs:margin") : void 0);
  const colPr = findChild(secPr, "hs:colPr");
  let columns;
  if (colPr && attrInt(colPr, "count", 1) > 1) {
    columns = {
      type: attrStr(colPr, "type", "NORMAL"),
      count: attrInt(colPr, "count", 1),
      gap: attrInt(colPr, "gap", 0),
      sameSizes: attrStr(colPr, "sameSz") === "1"
    };
  }
  let headerFooter;
  const headerNode = findChild(secPr, "hs:header");
  const footerNode = findChild(secPr, "hs:footer");
  if (headerNode || footerNode) {
    headerFooter = {};
    if (headerNode) {
      headerFooter.header = { paragraphs: parseParagraphs(headerNode) };
    }
    if (footerNode) {
      headerFooter.footer = { paragraphs: parseParagraphs(footerNode) };
    }
  }
  return {
    pageWidth: pagePr ? attrInt(pagePr, "width", 59528) : 59528,
    pageHeight: pagePr ? attrInt(pagePr, "height", 84188) : 84188,
    landscape: pagePr ? attrStr(pagePr, "landscape") === "LANDSCAPE" || attrStr(pagePr, "landscape") === "WIDELY" : false,
    gutterType: pagePr ? attrStr(pagePr, "gutterType", "LEFT_ONLY") : "LEFT_ONLY",
    pageMargin: pageMarginNode ? parsePageMargin(pageMarginNode) : defaultPageMargin(),
    columns,
    headerFooter
  };
}
function parsePageMargin(node) {
  return {
    left: attrInt(node, "left"),
    right: attrInt(node, "right"),
    top: attrInt(node, "top"),
    bottom: attrInt(node, "bottom"),
    header: attrInt(node, "header"),
    footer: attrInt(node, "footer"),
    gutter: attrInt(node, "gutter")
  };
}
function parseParagraphs(parent) {
  const paragraphs = [];
  for (const pNode of findChildren(parent, "hp:p")) {
    paragraphs.push(parseParagraph(pNode));
  }
  return paragraphs;
}
function parseParagraph(pNode) {
  const runs = [];
  for (const runNode of findChildren(pNode, "hp:run")) {
    const charPrIDRef = attrInt(runNode, "charPrIDRef");
    const lineBreak = findChild(runNode, "hp:lineBreak");
    const pageBreak2 = findChild(runNode, "hp:pageBreak");
    const colBreak = findChild(runNode, "hp:colBreak");
    if (lineBreak) {
      runs.push({ t: "break", breakType: "LINE", charPrIDRef });
    } else if (pageBreak2) {
      runs.push({ t: "break", breakType: "PAGE", charPrIDRef });
    } else if (colBreak) {
      runs.push({ t: "break", breakType: "COLUMN", charPrIDRef });
    } else {
      const tblNode = findChild(runNode, "hp:tbl");
      if (tblNode) {
        runs.push({ t: "table", table: parseTable(tblNode), charPrIDRef });
        continue;
      }
      const picNode = findChild(runNode, "hp:pic");
      if (picNode) {
        runs.push({ t: "picture", picture: parsePicture(picNode), charPrIDRef });
        continue;
      }
      const runTextNode = findChild(runNode, "hp:runText") || findChild(runNode, "hp:t");
      const text = runTextNode ? getTextContent(runTextNode) : "";
      runs.push({ t: "text", text, charPrIDRef });
    }
  }
  const pageBreakVal = attrStr(pNode, "pageBreak", "0");
  const pageBreak = pageBreakVal === "1" || pageBreakVal === "true";
  return {
    paraPrIDRef: attrInt(pNode, "paraPrIDRef"),
    styleIDRef: attrInt(pNode, "styleIDRef"),
    runs,
    ...pageBreak ? { pageBreak: true } : {}
  };
}
function parseTable(tblNode) {
  const rowCount = attrInt(tblNode, "rowCnt", 1);
  const colCount = attrInt(tblNode, "colCnt", 1);
  const borderFillIDRef = attrInt(tblNode, "borderFillIDRef", 1);
  const cellSpacing = attrInt(tblNode, "cellSpacing", 0);
  const szNode = findChild(tblNode, "hp:sz");
  const width = szNode ? attrInt(szNode, "width", 0) : attrInt(tblNode, "width", 0);
  const colSzNodes = findChildren(tblNode, "hp:colSz");
  let colWidths = colSzNodes.map((n) => attrInt(n, "width", 0));
  const rows = [];
  for (const trNode of findChildren(tblNode, "hp:tr")) {
    rows.push(parseTableRow(trNode));
  }
  if (colWidths.length === 0 && rows.length > 0) {
    colWidths = rows[0].cells.map((c) => c.width);
  }
  return {
    rowCount,
    colCount,
    width,
    borderFillIDRef,
    cellSpacing: cellSpacing || void 0,
    colWidths,
    rows
  };
}
function parseTableRow(trNode) {
  const cells = [];
  for (const tcNode of findChildren(trNode, "hp:tc")) {
    cells.push(parseTableCell(tcNode));
  }
  const height = attrInt(trNode, "height", 0) || (cells.length > 0 ? cells[0].height : 0);
  return { height, cells };
}
function parseTableCell(tcNode) {
  const cellSpanNode = findChild(tcNode, "hp:cellSpan");
  const colSpan = cellSpanNode ? attrInt(cellSpanNode, "colSpan", 1) : attrInt(tcNode, "colSpan", 1);
  const rowSpan = cellSpanNode ? attrInt(cellSpanNode, "rowSpan", 1) : attrInt(tcNode, "rowSpan", 1);
  const cellSzNode = findChild(tcNode, "hp:cellSz");
  const width = cellSzNode ? attrInt(cellSzNode, "width", 0) : attrInt(tcNode, "width", 0);
  const height = cellSzNode ? attrInt(cellSzNode, "height", 0) : attrInt(tcNode, "height", 0);
  const borderFillIDRef = attrInt(tcNode, "borderFillIDRef", 1);
  let padding;
  const cellMarginNode = findChild(tcNode, "hp:cellMargin");
  if (cellMarginNode) {
    padding = {
      left: attrInt(cellMarginNode, "left"),
      right: attrInt(cellMarginNode, "right"),
      top: attrInt(cellMarginNode, "top"),
      bottom: attrInt(cellMarginNode, "bottom")
    };
  } else if (tcNode.attrs["paddingLeft"] !== void 0) {
    padding = {
      left: attrInt(tcNode, "paddingLeft"),
      right: attrInt(tcNode, "paddingRight"),
      top: attrInt(tcNode, "paddingTop"),
      bottom: attrInt(tcNode, "paddingBottom")
    };
  }
  const subList = findChild(tcNode, "hp:subList");
  const paragraphs = subList ? parseParagraphs(subList) : [];
  return { paragraphs, colSpan, rowSpan, width, height, borderFillIDRef, padding };
}
function parsePicture(picNode) {
  return {
    binDataIDRef: attrInt(picNode, "binDataIDRef", 0),
    width: attrInt(picNode, "width", 0),
    height: attrInt(picNode, "height", 0),
    offsetX: picNode.attrs["offsetX"] !== void 0 ? attrInt(picNode, "offsetX") : void 0,
    offsetY: picNode.attrs["offsetY"] !== void 0 ? attrInt(picNode, "offsetY") : void 0
  };
}
function getTextContent(node) {
  let text = node.text;
  for (const child of node.children) {
    text += getTextContent(child);
  }
  return unescapeXml(text);
}
function unescapeXml(str) {
  return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function defaultSectionDef() {
  return {
    pageWidth: 59528,
    pageHeight: 84188,
    pageMargin: defaultPageMargin(),
    landscape: false
  };
}
function defaultPageMargin() {
  return {
    left: 8504,
    right: 8504,
    top: 7087,
    bottom: 7087,
    header: 4252,
    footer: 4252,
    gutter: 0
  };
}
function parseContentHpfXml(xml) {
  const root = parseXml(xml);
  const metadata = findChild(root, "opf:metadata");
  const titleNode = metadata ? findChild(metadata, "opf:title") : void 0;
  const title = titleNode ? titleNode.text : "";
  const manifest = findChild(root, "opf:manifest");
  const items = manifest ? findChildren(manifest, "opf:item") : [];
  const sectionFiles = [];
  const binDataFiles = [];
  for (const item of items) {
    const id = attrStr(item, "id");
    const href = attrStr(item, "href");
    const mediaType = attrStr(item, "media-type");
    if (id.startsWith("section")) {
      sectionFiles.push(href);
    } else if (id.startsWith("bindata")) {
      binDataFiles.push({ id, href, mediaType });
    }
  }
  if (sectionFiles.length === 0) {
    const spine = findChild(root, "opf:spine");
    if (spine) {
      for (const itemref of findChildren(spine, "opf:itemref")) {
        const idref = attrStr(itemref, "idref");
        if (idref.startsWith("section")) {
          sectionFiles.push(`${idref}.xml`);
        }
      }
    }
  }
  return { title, sectionFiles, binDataFiles };
}
var HWPXError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "HWPXError";
  }
};
var HWPXValidationError = class extends HWPXError {
  constructor(field, message) {
    super(`Validation error on "${field}": ${message}`);
    this.name = "HWPXValidationError";
    this.field = field;
  }
};
function readHwpx(data, _opts) {
  const files = extractZip(data);
  const mimetype = files["mimetype"];
  if (mimetype) {
    const mt = decodeUtf8(mimetype);
    if (!mt.includes("hwp")) {
      throw new HWPXError(`Invalid mimetype: "${mt}"`);
    }
  }
  const contentHpf = getFile(files, "Contents/content.hpf");
  const hpfInfo = parseContentHpfXml(decodeUtf8(contentHpf));
  const headerXml = getFile(files, "Contents/header.xml");
  const head = parseHeaderXml(decodeUtf8(headerXml));
  const sections = hpfInfo.sectionFiles.map((file) => {
    const path = file.startsWith("Contents/") ? file : `Contents/${file}`;
    const sectionData = getFile(files, path);
    return parseSectionXml(decodeUtf8(sectionData));
  });
  const meta = parseMeta(files, hpfInfo.title);
  const binData = parseBinData(files, hpfInfo.binDataFiles);
  return { meta, head, sections, binData };
}
function getFile(files, path) {
  const data = files[path];
  if (!data) {
    throw new HWPXError(`Required file not found in HWPX archive: ${path}`);
  }
  return data;
}
function parseMeta(files, title) {
  const meta = {
    hwpVersion: "5.1.0.1",
    title: title || void 0
  };
  const versionData = files["version.xml"];
  if (versionData) {
    const versionXml = decodeUtf8(versionData);
    const versionMatch = versionXml.match(/<ha:appversion[^>]*>([^<]+)/);
    if (versionMatch) {
      meta.hwpVersion = versionMatch[1];
    }
  }
  return meta;
}
function parseBinData(files, binDataFiles) {
  const items = [];
  for (let i2 = 0; i2 < binDataFiles.length; i2++) {
    const { href, mediaType } = binDataFiles[i2];
    const cleanPath = href.replace(/^\.\.\//, "");
    const path = cleanPath.startsWith("BinData/") ? cleanPath : `BinData/${cleanPath}`;
    const data = files[path];
    if (!data) continue;
    const name = path.replace("BinData/", "");
    const format = mediaTypeToFormat(mediaType);
    items.push({
      id: i2 + 1,
      format,
      name,
      data
    });
  }
  return items;
}
function mediaTypeToFormat(mediaType) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/x-wmf": "wmf",
    "image/x-emf": "emf"
  };
  return map[mediaType] || "png";
}
var HEADER_SIZE = 512;
var DIR_ENTRY_SIZE = 128;
var ENDOFCHAIN = 4294967294;
function parseOle(data) {
  if (data.length < HEADER_SIZE) {
    throw new HWPXError("File too small for OLE format");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== 3759263696 || view.getUint32(4, true) !== 2712738529) {
    throw new HWPXError("Invalid OLE magic number");
  }
  const sectorSize = 1 << view.getUint16(30, true);
  const miniSectorSize = 1 << view.getUint16(32, true);
  const fatSectors = view.getInt32(44, true);
  const firstDirSector = view.getInt32(48, true);
  const miniStreamCutoff = view.getUint32(56, true);
  const firstMiniFatSector = view.getInt32(60, true);
  const miniSectorCount = view.getInt32(64, true);
  const firstDifatSector = view.getInt32(68, true);
  const difatCount = view.getInt32(72, true);
  const difat = [];
  for (let i2 = 0; i2 < 109 && i2 < fatSectors; i2++) {
    difat.push(view.getInt32(76 + i2 * 4, true));
  }
  let difatSector = firstDifatSector;
  while (difatSector >= 0 && difatSector !== ENDOFCHAIN && difat.length < fatSectors) {
    const offset = sectorOffset(difatSector, sectorSize);
    const entriesPerSector = sectorSize / 4 - 1;
    for (let i2 = 0; i2 < entriesPerSector && difat.length < fatSectors; i2++) {
      difat.push(view.getInt32(offset + i2 * 4, true));
    }
    difatSector = view.getInt32(offset + entriesPerSector * 4, true);
  }
  const fat = [];
  for (const fatSectorIdx of difat) {
    if (fatSectorIdx < 0) break;
    const offset = sectorOffset(fatSectorIdx, sectorSize);
    for (let i2 = 0; i2 < sectorSize / 4; i2++) {
      fat.push(view.getInt32(offset + i2 * 4, true));
    }
  }
  const dirData = readSectorChain(data, fat, firstDirSector, sectorSize);
  const entries = parseDirectoryEntries(dirData);
  let miniFat = [];
  if (firstMiniFatSector >= 0 && firstMiniFatSector !== ENDOFCHAIN) {
    const miniFatData = readSectorChain(data, fat, firstMiniFatSector, sectorSize);
    const miniFatView = new DataView(miniFatData.buffer, miniFatData.byteOffset, miniFatData.byteLength);
    for (let i2 = 0; i2 < miniFatData.length / 4; i2++) {
      miniFat.push(miniFatView.getInt32(i2 * 4, true));
    }
  }
  let miniStream = new Uint8Array(0);
  if (entries.length > 0 && entries[0].startSector >= 0) {
    miniStream = readSectorChain(data, fat, entries[0].startSector, sectorSize);
  }
  function getStreamByEntry(entry) {
    if (entry.size === 0) return new Uint8Array(0);
    if (entry.size < miniStreamCutoff) {
      return readMiniSectorChain(miniStream, miniFat, entry.startSector, miniSectorSize, entry.size);
    } else {
      const raw = readSectorChain(data, fat, entry.startSector, sectorSize);
      return raw.slice(0, entry.size);
    }
  }
  function getStream(name) {
    const entry = entries.find((e) => e.name === name && e.type === 2);
    if (!entry) {
      throw new HWPXError(`OLE stream not found: ${name}`);
    }
    return getStreamByEntry(entry);
  }
  function listStreams() {
    return entries.filter((e) => e.type === 2).map((e) => e.name);
  }
  return { entries, getStream, getStreamByEntry, listStreams };
}
function sectorOffset(sector, sectorSize) {
  return HEADER_SIZE + sector * sectorSize;
}
function readSectorChain(data, fat, startSector, sectorSize) {
  const sectors = [];
  let sector = startSector;
  const maxSectors = fat.length;
  while (sector >= 0 && sector !== ENDOFCHAIN && sectors.length < maxSectors) {
    sectors.push(sector);
    sector = fat[sector] ?? ENDOFCHAIN;
  }
  const result = new Uint8Array(sectors.length * sectorSize);
  for (let i2 = 0; i2 < sectors.length; i2++) {
    const offset = sectorOffset(sectors[i2], sectorSize);
    const chunk = data.subarray(offset, offset + sectorSize);
    result.set(chunk, i2 * sectorSize);
  }
  return result;
}
function readMiniSectorChain(miniStream, miniFat, startSector, miniSectorSize, size) {
  const sectors = [];
  let sector = startSector;
  const maxSectors = miniFat.length;
  while (sector >= 0 && sector !== ENDOFCHAIN && sectors.length < maxSectors) {
    sectors.push(sector);
    sector = miniFat[sector] ?? ENDOFCHAIN;
  }
  const result = new Uint8Array(sectors.length * miniSectorSize);
  for (let i2 = 0; i2 < sectors.length; i2++) {
    const offset = sectors[i2] * miniSectorSize;
    const chunk = miniStream.subarray(offset, offset + miniSectorSize);
    result.set(chunk, i2 * miniSectorSize);
  }
  return result.slice(0, size);
}
function parseDirectoryEntries(data) {
  const entries = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let offset = 0; offset + DIR_ENTRY_SIZE <= data.length; offset += DIR_ENTRY_SIZE) {
    const nameLen = view.getUint16(offset + 64, true);
    if (nameLen === 0) continue;
    const nameBytes = data.subarray(offset, offset + nameLen - 2);
    let name = "";
    for (let i2 = 0; i2 < nameBytes.length; i2 += 2) {
      const code = nameBytes[i2] | nameBytes[i2 + 1] << 8;
      if (code === 0) break;
      name += String.fromCharCode(code);
    }
    const type = data[offset + 66];
    const startSector = view.getInt32(offset + 116, true);
    const size = view.getUint32(offset + 120, true);
    const leftSiblingId = view.getInt32(offset + 68, true);
    const rightSiblingId = view.getInt32(offset + 72, true);
    const childId = view.getInt32(offset + 76, true);
    entries.push({
      name,
      type,
      size,
      startSector,
      childId,
      leftSiblingId,
      rightSiblingId
    });
  }
  return entries;
}
var TAG = {
  DOCUMENT_PROPERTIES: 16,
  ID_MAPPINGS: 17,
  BIN_DATA: 18,
  FACE_NAME: 19,
  BORDER_FILL: 20,
  CHAR_SHAPE: 21,
  TAB_DEF: 22,
  NUMBERING: 23,
  BULLET: 24,
  PARA_SHAPE: 25,
  STYLE: 26,
  // BodyText
  PARA_HEADER: 66,
  PARA_TEXT: 67,
  PARA_CHAR_SHAPE: 68,
  PARA_LINE_SEG: 69,
  CTRL_HEADER: 71,
  PAGE_DEF: 72,
  FOOTNOTE_SHAPE: 73,
  PAGE_BORDER_FILL: 74,
  LIST_HEADER: 75,
  TABLE: 79,
  CTRL_DATA: 80,
  SHAPE_COMPONENT: 82
};
function parseRecords(data) {
  const records = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  while (offset + 4 <= data.length) {
    const header = view.getUint32(offset, true);
    const tagId = header & 1023;
    const level = header >> 10 & 1023;
    let size = header >> 20 & 4095;
    offset += 4;
    if (size === 4095) {
      if (offset + 4 > data.length) break;
      size = view.getUint32(offset, true);
      offset += 4;
    }
    if (offset + size > data.length) break;
    records.push({
      tagId,
      level,
      size,
      data: data.subarray(offset, offset + size)
    });
    offset += size;
  }
  return records;
}
function readUtf16(data, offset, charCount) {
  let str = "";
  for (let i2 = 0; i2 < charCount; i2++) {
    const code = data[offset + i2 * 2] | data[offset + i2 * 2 + 1] << 8;
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}
function readU16(data, offset) {
  return data[offset] | data[offset + 1] << 8;
}
function readU32(data, offset) {
  return (data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 | data[offset + 3] << 24) >>> 0;
}
function readI32(data, offset) {
  return data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 | data[offset + 3] << 24;
}
var HWPUNIT_PER_INCH = 7200;
var MM_PER_INCH = 25.4;
var PT_PER_INCH = 72;
function mmToHwpunit(mm) {
  return Math.round(mm / MM_PER_INCH * HWPUNIT_PER_INCH);
}
function hwpunitToMm(hu) {
  return hu / HWPUNIT_PER_INCH * MM_PER_INCH;
}
function ptToHwpunit(pt) {
  return Math.round(pt / PT_PER_INCH * HWPUNIT_PER_INCH);
}
function hwpunitToPt(hu) {
  return hu / HWPUNIT_PER_INCH * PT_PER_INCH;
}
function pxToHwpunit(px, dpi = 96) {
  return Math.round(px / dpi * HWPUNIT_PER_INCH);
}
function hwpunitToPx(hu, dpi = 96) {
  return hu / HWPUNIT_PER_INCH * dpi;
}
function ptToCharHeight(pt) {
  return Math.round(pt * 100);
}
function charHeightToPt(height) {
  return height / 100;
}
function hexToColorref(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return b << 16 | g << 8 | r;
}
function colorrefToHex(colorref) {
  const r = colorref & 255;
  const g = colorref >> 8 & 255;
  const b = colorref >> 16 & 255;
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}
function colorrefToRgbString(colorref) {
  const r = colorref & 255;
  const g = colorref >> 8 & 255;
  const b = colorref >> 16 & 255;
  return `${r}, ${g}, ${b}`;
}
function rgbToColorref(rgb) {
  const r = rgb >> 16 & 255;
  const g = rgb >> 8 & 255;
  const b = rgb & 255;
  return b << 16 | g << 8 | r;
}
function defaultFontRef() {
  return { hangul: 0, latin: 0, hanja: 0, japanese: 0, other: 0, symbol: 0, user: 0 };
}
function createDefaultFontFaces() {
  return [
    { lang: "HANGUL", fontName: "\uD568\uCD08\uB86C\uB3CB\uC6C0", fontType: "ttf" },
    { lang: "LATIN", fontName: "\uD568\uCD08\uB86C\uB3CB\uC6C0", fontType: "ttf" },
    { lang: "HANJA", fontName: "\uD568\uCD08\uB86C\uB3CB\uC6C0", fontType: "ttf" },
    { lang: "JAPANESE", fontName: "\uD568\uCD08\uB86C\uB3CB\uC6C0", fontType: "ttf" },
    { lang: "OTHER", fontName: "\uD568\uCD08\uB86C\uB3CB\uC6C0", fontType: "ttf" },
    { lang: "SYMBOL", fontName: "\uD568\uCD08\uB86C\uB3CB\uC6C0", fontType: "ttf" },
    { lang: "USER", fontName: "\uD568\uCD08\uB86C\uB3CB\uC6C0", fontType: "ttf" }
  ];
}
function createDefaultCharProperty(id = 0) {
  return {
    id,
    height: ptToCharHeight(10),
    // 10pt
    textColor: hexToColorref("#000000"),
    bold: false,
    italic: false,
    underline: "NONE",
    strikeout: "NONE",
    fontRef: defaultFontRef(),
    useFontSpace: false,
    useKerning: true,
    relSize: 100,
    spacing: 0,
    charOffset: 0
  };
}
function createDefaultParaProperty(id = 0) {
  return {
    id,
    alignment: "JUSTIFY",
    lineSpacing: { type: "PERCENT", value: 160 },
    paraMargin: {
      left: 0,
      right: 0,
      indent: 0,
      prevSpacing: 0,
      nextSpacing: 0
    }
  };
}
function createDefaultBorderFill(id = 1) {
  const noBorder = {
    type: "NONE",
    width: "0.1mm",
    color: hexToColorref("#000000")
  };
  return {
    id,
    borders: {
      left: { ...noBorder },
      right: { ...noBorder },
      top: { ...noBorder },
      bottom: { ...noBorder }
    }
  };
}
function createDefaultStyles() {
  return [
    {
      id: 0,
      type: "PARA",
      name: "\uBC14\uD0D5\uAE00",
      engName: "Normal",
      paraPrIDRef: 0,
      charPrIDRef: 0,
      nextStyleIDRef: 0
    }
  ];
}
function createDefaultSectionDef() {
  return {
    pageWidth: mmToHwpunit(210),
    pageHeight: mmToHwpunit(297),
    pageMargin: createDefaultPageMargin(),
    landscape: false,
    gutterType: "LEFT_ONLY"
  };
}
function createDefaultPageMargin() {
  return {
    left: mmToHwpunit(30),
    right: mmToHwpunit(30),
    top: mmToHwpunit(25),
    bottom: mmToHwpunit(25),
    header: mmToHwpunit(15),
    footer: mmToHwpunit(15),
    gutter: 0
  };
}
function createDefaultHead() {
  return {
    fontFaces: createDefaultFontFaces(),
    charProperties: [createDefaultCharProperty(0)],
    paraProperties: [createDefaultParaProperty(0)],
    styles: createDefaultStyles(),
    borderFills: [createDefaultBorderFill(1)],
    bulletProperties: [],
    numberingProperties: [],
    compatibleDoc: "HWP"
  };
}
function createDefaultMeta() {
  return {
    hwpVersion: "5.1.0.1"
  };
}
function createDefaultDocument() {
  return {
    meta: createDefaultMeta(),
    head: createDefaultHead(),
    sections: [
      {
        def: createDefaultSectionDef(),
        paragraphs: []
      }
    ],
    binData: []
  };
}
function readHwp5(data) {
  const ole = parseOle(data);
  const fileHeader = ole.getStream("FileHeader");
  const compressed = isCompressed(fileHeader);
  const hwpVersion = readHwpVersion(fileHeader);
  const docInfoRaw = ole.getStream("DocInfo");
  const docInfoData = compressed ? tryDecompress(docInfoRaw) : docInfoRaw;
  const docInfoRecords = parseRecords(docInfoData);
  const head = parseDocInfo(docInfoRecords);
  const sections = parseBodyText(ole, compressed);
  const meta = {
    ...createDefaultMeta(),
    hwpVersion
  };
  return { meta, head, sections, binData: [] };
}
function isCompressed(fileHeader) {
  if (fileHeader.length < 40) return false;
  const flags = readU32(fileHeader, 36);
  return (flags & 1) !== 0;
}
function readHwpVersion(fileHeader) {
  if (fileHeader.length < 36) return "5.0.0.0";
  const major = fileHeader[35];
  const minor = fileHeader[34];
  const build = fileHeader[33];
  const revision = fileHeader[32];
  return `${major}.${minor}.${build}.${revision}`;
}
function tryDecompress(data) {
  try {
    return inflateSync(data);
  } catch {
    return data;
  }
}
function parseDocInfo(records) {
  const head = createDefaultHead();
  head.fontFaces = [];
  head.charProperties = [];
  head.paraProperties = [];
  head.styles = [];
  head.borderFills = [];
  let fontId = 0;
  let charPrId = 0;
  let paraPrId = 0;
  let styleId = 0;
  let borderFillId = 1;
  for (const rec of records) {
    switch (rec.tagId) {
      case TAG.FACE_NAME: {
        const face = parseFaceName(rec.data, fontId);
        if (face) {
          head.fontFaces.push(face);
          fontId++;
        }
        break;
      }
      case TAG.CHAR_SHAPE: {
        const cp = parseCharShape(rec.data, charPrId);
        if (cp) {
          head.charProperties.push(cp);
          charPrId++;
        }
        break;
      }
      case TAG.PARA_SHAPE: {
        const pp = parseParaShape(rec.data, paraPrId);
        if (pp) {
          head.paraProperties.push(pp);
          paraPrId++;
        }
        break;
      }
      case TAG.STYLE: {
        const style = parseStyle(rec.data, styleId);
        if (style) {
          head.styles.push(style);
          styleId++;
        }
        break;
      }
      case TAG.BORDER_FILL: {
        const bf = parseBorderFillRecord(rec.data, borderFillId);
        if (bf) {
          head.borderFills.push(bf);
          borderFillId++;
        }
        break;
      }
    }
  }
  if (head.fontFaces.length === 0) head.fontFaces = [{ lang: "HANGUL", fontName: "\uD568\uCD08\uB86C\uB3CB\uC6C0", fontType: "ttf" }];
  if (head.charProperties.length === 0) head.charProperties = [{ id: 0, height: 1e3, textColor: 0, fontRef: { hangul: 0, latin: 0, hanja: 0, japanese: 0, other: 0, symbol: 0, user: 0 } }];
  if (head.paraProperties.length === 0) head.paraProperties = [{ id: 0, alignment: "JUSTIFY", lineSpacing: { type: "PERCENT", value: 160 }, paraMargin: { left: 0, right: 0, indent: 0, prevSpacing: 0, nextSpacing: 0 } }];
  if (head.styles.length === 0) head.styles = [{ id: 0, type: "PARA", name: "\uBC14\uD0D5\uAE00", engName: "Normal", paraPrIDRef: 0, charPrIDRef: 0 }];
  if (head.borderFills.length === 0) head.borderFills = [createDefaultBorderFill(1)];
  return head;
}
function parseFaceName(data, id) {
  if (data.length < 6) return null;
  const nameLen = readU16(data, 2);
  if (data.length < 4 + nameLen * 2) return null;
  const fontName = readUtf16(data, 4, nameLen);
  const langMap = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"];
  const lang = langMap[id % 7] || "HANGUL";
  return { lang, fontName, fontType: "ttf" };
}
function parseCharShape(data, id) {
  if (data.length < 72) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const fontRef = {
    hangul: readU16(data, 0),
    latin: readU16(data, 2),
    hanja: readU16(data, 4),
    japanese: readU16(data, 6),
    other: readU16(data, 8),
    symbol: readU16(data, 10),
    user: readU16(data, 12)
  };
  const height = readI32(data, 70);
  let textColor = 0;
  if (data.length >= 78) {
    textColor = readU32(data, 74);
  }
  let bold = false;
  let italic = false;
  if (data.length >= 74) {
    const attr = readU32(data, 70);
  }
  return {
    id,
    height: height > 0 ? height : 1e3,
    textColor: textColor & 16777215,
    fontRef,
    bold,
    italic
  };
}
function parseParaShape(data, id) {
  if (data.length < 8) return null;
  const attr = readU32(data, 0);
  const alignment = ["JUSTIFY", "LEFT", "RIGHT", "CENTER", "DISTRIBUTE", "DISTRIBUTE_SPACE"][attr & 7] || "JUSTIFY";
  let leftMargin = 0, rightMargin = 0, indent = 0;
  if (data.length >= 20) {
    leftMargin = readI32(data, 4);
    rightMargin = readI32(data, 8);
    indent = readI32(data, 12);
  }
  let prevSpacing = 0, nextSpacing = 0;
  if (data.length >= 28) {
    prevSpacing = readI32(data, 16);
    nextSpacing = readI32(data, 20);
  }
  let lineSpacingValue = 160;
  if (data.length >= 32) {
    lineSpacingValue = readI32(data, 24);
  }
  return {
    id,
    alignment,
    lineSpacing: { type: "PERCENT", value: lineSpacingValue > 0 ? lineSpacingValue : 160 },
    paraMargin: {
      left: Math.max(0, leftMargin),
      right: Math.max(0, rightMargin),
      indent,
      prevSpacing: Math.max(0, prevSpacing),
      nextSpacing: Math.max(0, nextSpacing)
    }
  };
}
function parseStyle(data, id) {
  if (data.length < 8) return null;
  const nameLen = readU16(data, 0);
  let offset = 2;
  const name = readUtf16(data, offset, nameLen);
  offset += nameLen * 2;
  let engName = "";
  if (offset + 2 <= data.length) {
    const engNameLen = readU16(data, offset);
    offset += 2;
    if (offset + engNameLen * 2 <= data.length) {
      engName = readUtf16(data, offset, engNameLen);
      offset += engNameLen * 2;
    }
  }
  let type = "PARA";
  let paraPrIDRef = 0;
  let charPrIDRef = 0;
  if (offset + 4 <= data.length) {
    const styleType = data[offset];
    type = styleType === 1 ? "CHAR" : "PARA";
    offset += 1;
  }
  return {
    id,
    type,
    name: name || `Style${id}`,
    engName: engName || void 0,
    paraPrIDRef,
    charPrIDRef
  };
}
function parseBorderFillRecord(data, id) {
  if (data.length < 2) return null;
  return createDefaultBorderFill(id);
}
function parseBodyText(ole, compressed) {
  const sections = [];
  const streams = ole.listStreams();
  const sectionStreams = streams.filter((name) => /^Section\d+$/.test(name)).sort((a, b) => {
    const numA = parseInt(a.replace("Section", ""), 10);
    const numB = parseInt(b.replace("Section", ""), 10);
    return numA - numB;
  });
  if (sectionStreams.length === 0) {
    for (const entry of ole.entries) {
      if (/^Section\d+$/.test(entry.name) && entry.type === 2) {
        sectionStreams.push(entry.name);
      }
    }
    sectionStreams.sort();
  }
  for (const streamName of sectionStreams) {
    try {
      const raw = ole.getStream(streamName);
      const sectionData = compressed ? tryDecompress(raw) : raw;
      const records = parseRecords(sectionData);
      sections.push(parseSectionRecords(records));
    } catch {
      sections.push({ def: createDefaultSectionDef(), paragraphs: [] });
    }
  }
  if (sections.length === 0) {
    sections.push({ def: createDefaultSectionDef(), paragraphs: [] });
  }
  return sections;
}
function parseSectionRecords(records) {
  const paragraphs = [];
  let currentParaCharShapeRef = 0;
  let currentParaStyleRef = 0;
  for (let i2 = 0; i2 < records.length; i2++) {
    const rec = records[i2];
    if (rec.tagId === TAG.PARA_HEADER) {
      if (rec.data.length >= 4) {
        const nCharShapeRef = readU32(rec.data, 0);
      }
      let textRec = null;
      let charShapeRec = null;
      for (let j = i2 + 1; j < records.length && records[j].level > rec.level; j++) {
        if (records[j].tagId === TAG.PARA_TEXT && !textRec) {
          textRec = records[j];
        }
        if (records[j].tagId === TAG.PARA_CHAR_SHAPE && !charShapeRec) {
          charShapeRec = records[j];
        }
      }
      const text = textRec ? parseParaText(textRec.data) : "";
      const charPrIDRef = charShapeRec ? readU32(charShapeRec.data, 4) : 0;
      const paraPrIDRef = rec.data.length >= 6 ? readU16(rec.data, 4) : 0;
      const styleIDRef = rec.data.length >= 8 ? readU16(rec.data, 6) : 0;
      paragraphs.push({
        paraPrIDRef,
        styleIDRef,
        runs: [{ t: "text", text, charPrIDRef }]
      });
    }
    if (rec.tagId === TAG.PAGE_DEF) {
    }
  }
  return {
    def: createDefaultSectionDef(),
    paragraphs
  };
}
function parseParaText(data) {
  let text = "";
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let offset = 0; offset + 1 < data.length; offset += 2) {
    const ch = view.getUint16(offset, true);
    if (ch < 32) {
      switch (ch) {
        case 13:
        // paragraph break
        case 10:
          break;
        case 9:
          text += "	";
          break;
        case 1:
        // reserved
        case 2:
        // section/column control
        case 3:
          offset += 14;
          break;
        case 4:
        // field end
        case 11:
        // control char (inline)
        case 12:
        // control char (extended)
        case 15:
        // hyphen
        case 16:
        // reserved
        case 17:
        // reserved
        case 18:
        // reserved
        case 23:
        // reserved
        case 24:
          break;
        default:
          break;
      }
    } else {
      text += String.fromCharCode(ch);
    }
  }
  return text;
}
function detectFormat(data) {
  if (data.length < 4) return "unknown";
  if (data[0] === 80 && data[1] === 75 && data[2] === 3 && data[3] === 4) {
    return "hwpx";
  }
  if (data[0] === 208 && data[1] === 207 && data[2] === 17 && data[3] === 224) {
    return "hwp5";
  }
  return "unknown";
}
var PdfBuilder = class {
  constructor() {
    this.objects = [];
    this.offsets = [];
    this.output = "";
  }
  nextId() {
    return this.objects.length + 1;
  }
  addObject(content) {
    const id = this.nextId();
    this.objects.push(content);
    return id;
  }
  build() {
    this.output = "%PDF-1.4\n%\xC0\xC1\xC2\xC3\n";
    for (let i2 = 0; i2 < this.objects.length; i2++) {
      this.offsets.push(this.output.length);
      this.output += `${i2 + 1} 0 obj
${this.objects[i2]}
endobj
`;
    }
    const xrefOffset = this.output.length;
    this.output += "xref\n";
    this.output += `0 ${this.objects.length + 1}
`;
    this.output += "0000000000 65535 f \n";
    for (const off of this.offsets) {
      this.output += off.toString().padStart(10, "0") + " 00000 n \n";
    }
    this.output += "trailer\n";
    this.output += `<< /Size ${this.objects.length + 1} /Root 1 0 R >>
`;
    this.output += "startxref\n";
    this.output += `${xrefOffset}
`;
    this.output += "%%EOF\n";
    return stringToBytes(this.output);
  }
};
function writePdf(doc, opts) {
  const korFont = opts?.fontName || "Malgun Gothic";
  const latFont = opts?.latinFontName || "Helvetica";
  const pdf = new PdfBuilder();
  const catalogId = pdf.addObject("");
  const pagesId = pdf.addObject("");
  const cidFontId = pdf.addObject(
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${sanitizeName(korFont)} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 1000 >>`
  );
  const korFontId = pdf.addObject(
    `<< /Type /Font /Subtype /Type0 /BaseFont /${sanitizeName(korFont)} /Encoding /Identity-H /DescendantFonts [${cidFontId} 0 R] /ToUnicode ${pdf.nextId() + 1} 0 R >>`
  );
  const cmapStream = buildToUnicodeCMap();
  const cmapId = pdf.addObject(
    `<< /Length ${cmapStream.length} >>
stream
${cmapStream}
endstream`
  );
  pdf.objects[korFontId - 1] = `<< /Type /Font /Subtype /Type0 /BaseFont /${sanitizeName(korFont)} /Encoding /Identity-H /DescendantFonts [${cidFontId} 0 R] /ToUnicode ${cmapId} 0 R >>`;
  const latFontId = pdf.addObject(
    `<< /Type /Font /Subtype /Type1 /BaseFont /${sanitizeName(latFont)} /Encoding /WinAnsiEncoding >>`
  );
  const fontResources = `/F1 ${korFontId} 0 R /F2 ${latFontId} 0 R`;
  const pageIds = [];
  for (const section of doc.sections) {
    const pageW = section.def.pageWidth / 7200 * 72;
    const pageH = section.def.pageHeight / 7200 * 72;
    const ml = section.def.pageMargin.left / 7200 * 72;
    const mr = section.def.pageMargin.right / 7200 * 72;
    const mt = section.def.pageMargin.top / 7200 * 72;
    const mb = section.def.pageMargin.bottom / 7200 * 72;
    const bodyW = pageW - ml - mr;
    const bodyH = pageH - mt - mb;
    const ctx = {
      doc,
      pdf,
      pagesId,
      fontResources,
      pageW,
      pageH,
      ml,
      mr,
      mt,
      mb,
      bodyW,
      bodyH,
      pageIds
    };
    renderSection(ctx, section);
  }
  pdf.objects[0] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
  pdf.objects[1] = `<< /Type /Pages /Kids [${kids}] /Count ${pageIds.length} >>`;
  return pdf.build();
}
function renderSection(ctx, section) {
  let page = newPage(ctx);
  for (const para of section.paragraphs) {
    for (const run of para.runs) {
      if (run.t === "text") {
        const fontSize = getFontSize(ctx.doc, run.charPrIDRef);
        const lineHeight = fontSize * 1.6;
        if (page.y - lineHeight < 0) {
          flushPage(ctx, page);
          page = newPage(ctx);
        }
        if (run.text) {
          const color = getTextColor(ctx.doc, run.charPrIDRef);
          const bold = isBold(ctx.doc, run.charPrIDRef);
          if (color !== "0 0 0") {
            page.ops.push(color + " rg");
          }
          const lines = wrapText(run.text, fontSize, ctx.bodyW);
          for (const line of lines) {
            if (page.y - lineHeight < 0) {
              flushPage(ctx, page);
              page = newPage(ctx);
            }
            page.ops.push("BT");
            page.ops.push(`/F1 ${fontSize} Tf`);
            page.ops.push(`${ctx.ml} ${ctx.mt + page.y - lineHeight} Td`);
            page.ops.push(`<${toUtf16Hex(line)}> Tj`);
            page.ops.push("ET");
            page.y -= lineHeight;
          }
          if (color !== "0 0 0") {
            page.ops.push("0 0 0 rg");
          }
        } else {
          page.y -= fontSize * 1.6;
        }
      } else if (run.t === "table") {
        const tableHeight = estimateTableHeight(run.table, ctx.doc);
        if (page.y - tableHeight < 0 && page.y < ctx.bodyH - 10) {
          flushPage(ctx, page);
          page = newPage(ctx);
        }
        renderTable(ctx, page, run.table);
      }
    }
  }
  flushPage(ctx, page);
}
function newPage(ctx) {
  return { ops: [], y: ctx.bodyH };
}
function flushPage(ctx, page) {
  if (page.ops.length === 0) return;
  const stream = page.ops.join("\n");
  const streamId = ctx.pdf.addObject(
    `<< /Length ${byteLength(stream)} >>
stream
${stream}
endstream`
  );
  const pageId = ctx.pdf.addObject(
    `<< /Type /Page /Parent ${ctx.pagesId} 0 R /MediaBox [0 0 ${fmt(ctx.pageW)} ${fmt(ctx.pageH)}] /Resources << /Font << ${ctx.fontResources} >> >> /Contents ${streamId} 0 R >>`
  );
  ctx.pageIds.push(pageId);
}
function renderTable(ctx, page, table) {
  const tableW = table.width / 7200 * 72;
  const scale = Math.min(1, ctx.bodyW / tableW);
  const startX = ctx.ml;
  const startY = ctx.mt + page.y;
  for (const row of table.rows) {
    const rowH = row.height / 7200 * 72 * scale;
    let cellX = startX;
    for (const cell of row.cells) {
      const cellW = cell.width / 7200 * 72 * scale;
      const cellH = cell.height / 7200 * 72 * scale;
      const cellY = startY - rowH;
      page.ops.push("0.5 w");
      page.ops.push(`${fmt(cellX)} ${fmt(cellY)} ${fmt(cellW)} ${fmt(cellH)} re S`);
      const text = cell.paragraphs.flatMap((p) => p.runs.filter((r) => r.t === "text").map((r) => r.text)).join(" ");
      if (text) {
        const fontSize = 8 * scale;
        const textX = cellX + 3;
        const textY = cellY + cellH - fontSize - 2;
        page.ops.push("BT");
        page.ops.push(`/F1 ${fmt(fontSize)} Tf`);
        page.ops.push(`${fmt(textX)} ${fmt(textY)} Td`);
        page.ops.push(`<${toUtf16Hex(text.substring(0, 100))}> Tj`);
        page.ops.push("ET");
      }
      cellX += cellW;
    }
    page.y -= rowH;
    startY === ctx.mt + page.y + rowH;
  }
}
function estimateTableHeight(table, doc) {
  let h = 0;
  for (const row of table.rows) {
    h += row.height / 7200 * 72;
  }
  return h;
}
function getFontSize(doc, charPrIDRef) {
  const cp = doc.head.charProperties.find((c) => c.id === charPrIDRef);
  if (!cp) return 10;
  return cp.height / 100;
}
function getTextColor(doc, charPrIDRef) {
  const cp = doc.head.charProperties.find((c) => c.id === charPrIDRef);
  if (!cp || cp.textColor === 0) return "0 0 0";
  const r = (cp.textColor & 255) / 255;
  const g = (cp.textColor >> 8 & 255) / 255;
  const b = (cp.textColor >> 16 & 255) / 255;
  return `${fmt(r)} ${fmt(g)} ${fmt(b)}`;
}
function isBold(doc, charPrIDRef) {
  const cp = doc.head.charProperties.find((c) => c.id === charPrIDRef);
  return cp?.bold || false;
}
function wrapText(text, fontSize, maxWidth) {
  const lines = [];
  let current = "";
  let currentWidth = 0;
  for (const ch of text) {
    const w = ch.charCodeAt(0) > 127 ? fontSize : fontSize * 0.5;
    if (currentWidth + w > maxWidth && current) {
      lines.push(current);
      current = "";
      currentWidth = 0;
    }
    current += ch;
    currentWidth += w;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}
function buildToUnicodeCMap() {
  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo",
    "<< /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
    "1 beginbfrange",
    "<0000> <FFFF> <0000>",
    "endbfrange",
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end"
  ].join("\n");
}
function toUtf16Hex(str) {
  let hex = "";
  for (let i2 = 0; i2 < str.length; i2++) {
    const code = str.charCodeAt(i2);
    hex += code.toString(16).padStart(4, "0");
  }
  return hex.toUpperCase();
}
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, "");
}
function fmt(n) {
  return Number(n.toFixed(2)).toString();
}
function byteLength(str) {
  let len = 0;
  for (let i2 = 0; i2 < str.length; i2++) {
    const code = str.charCodeAt(i2);
    if (code <= 127) len++;
    else if (code <= 2047) len += 2;
    else len += 3;
  }
  return len;
}
function stringToBytes(str) {
  const bytes = [];
  for (let i2 = 0; i2 < str.length; i2++) {
    const code = str.charCodeAt(i2);
    if (code <= 255) {
      bytes.push(code);
    } else {
      if (code <= 2047) {
        bytes.push(192 | code >> 6, 128 | code & 63);
      } else {
        bytes.push(224 | code >> 12, 128 | code >> 6 & 63, 128 | code & 63);
      }
    }
  }
  return new Uint8Array(bytes);
}
var IdCounter = class {
  constructor(start = 0) {
    this.value = start;
  }
  next() {
    return this.value++;
  }
  current() {
    return this.value;
  }
  reset(start = 0) {
    this.value = start;
  }
};
var HWPXBuilder = class {
  constructor() {
    this.charPrCache = /* @__PURE__ */ new Map();
    this.doc = createDefaultDocument();
    this.charPrIdCounter = new IdCounter(1);
    this.paraPrIdCounter = new IdCounter(1);
    this.borderFillIdCounter = new IdCounter(2);
    this.binDataIdCounter = new IdCounter(1);
  }
  /** 단일 스타일 문단 추가 */
  addParagraph(text, style) {
    const charPrId = this.getOrCreateCharPr(style);
    const para = {
      paraPrIDRef: 0,
      styleIDRef: 0,
      runs: [
        {
          t: "text",
          text,
          charPrIDRef: charPrId
        }
      ]
    };
    this.currentSection().paragraphs.push(para);
    return this;
  }
  /** 복수 스타일 세그먼트로 구성된 문단 추가 */
  addStyledText(segments) {
    const runs = segments.map((seg) => ({
      t: "text",
      text: seg.text,
      charPrIDRef: this.getOrCreateCharPr(seg.style)
    }));
    const para = {
      paraPrIDRef: 0,
      styleIDRef: 0,
      runs
    };
    this.currentSection().paragraphs.push(para);
    return this;
  }
  /** 빈 문단(빈 줄) 추가 */
  addEmptyParagraph() {
    const para = {
      paraPrIDRef: 0,
      styleIDRef: 0,
      runs: [
        {
          t: "text",
          text: "",
          charPrIDRef: 0
        }
      ]
    };
    this.currentSection().paragraphs.push(para);
    return this;
  }
  /** 페이지 설정 변경 */
  setPageSettings(opts) {
    const def = this.currentSection().def;
    if (opts.width !== void 0) def.pageWidth = mmToHwpunit(opts.width);
    if (opts.height !== void 0) def.pageHeight = mmToHwpunit(opts.height);
    if (opts.landscape !== void 0) def.landscape = opts.landscape;
    if (opts.marginLeft !== void 0) def.pageMargin.left = mmToHwpunit(opts.marginLeft);
    if (opts.marginRight !== void 0) def.pageMargin.right = mmToHwpunit(opts.marginRight);
    if (opts.marginTop !== void 0) def.pageMargin.top = mmToHwpunit(opts.marginTop);
    if (opts.marginBottom !== void 0) def.pageMargin.bottom = mmToHwpunit(opts.marginBottom);
    return this;
  }
  /** 테이블 추가 (string[][] 데이터, 셀 병합은 merges 옵션) */
  addTable(data, opts) {
    const rowCount = data.length;
    const colCount = data.length > 0 ? data[0].length : 0;
    if (rowCount === 0 || colCount === 0) return this;
    const secDef = this.currentSection().def;
    const bodyWidth = opts?.width ? mmToHwpunit(opts.width) : secDef.pageWidth - secDef.pageMargin.left - secDef.pageMargin.right;
    const colWidths = opts?.colWidths ? opts.colWidths.map((w) => mmToHwpunit(w)) : Array(colCount).fill(Math.floor(bodyWidth / colCount));
    const borderFillId = this.getOrCreateTableBorderFill(opts?.borderStyle || "SOLID");
    const cellPadding = opts?.cellPadding ? mmToHwpunit(opts.cellPadding) : mmToHwpunit(1.5);
    const rowHeight = mmToHwpunit(10);
    const mergeMap = /* @__PURE__ */ new Map();
    if (opts?.merges) {
      for (const m of opts.merges) {
        mergeMap.set(`${m.row},${m.col}`, { rowSpan: m.rowSpan, colSpan: m.colSpan });
        for (let r = m.row; r < m.row + m.rowSpan; r++) {
          for (let c = m.col; c < m.col + m.colSpan; c++) {
            if (r !== m.row || c !== m.col) {
              mergeMap.set(`${r},${c}`, "hidden");
            }
          }
        }
      }
    }
    const rows = data.map((rowData, ri) => ({
      height: rowHeight,
      cells: rowData.map((cellText, ci) => {
        const key = `${ri},${ci}`;
        const mergeInfo = mergeMap.get(key);
        if (mergeInfo === "hidden") return null;
        const span = mergeInfo ? mergeInfo : { rowSpan: 1, colSpan: 1 };
        let cellWidth = 0;
        for (let c = ci; c < ci + span.colSpan && c < colWidths.length; c++) {
          cellWidth += colWidths[c];
        }
        return {
          paragraphs: [{
            paraPrIDRef: 0,
            styleIDRef: 0,
            runs: [{ t: "text", text: cellText, charPrIDRef: 0 }]
          }],
          colSpan: span.colSpan,
          rowSpan: span.rowSpan,
          width: cellWidth || colWidths[ci] || colWidths[0],
          height: rowHeight * span.rowSpan,
          borderFillIDRef: borderFillId,
          padding: {
            left: cellPadding,
            right: cellPadding,
            top: cellPadding,
            bottom: cellPadding
          }
        };
      }).filter((c) => c !== null)
    }));
    const table = {
      rows,
      borderFillIDRef: borderFillId,
      width: bodyWidth,
      rowCount,
      colCount,
      colWidths
    };
    const para = {
      paraPrIDRef: 0,
      styleIDRef: 0,
      runs: [{ t: "table", table, charPrIDRef: 0 }]
    };
    this.currentSection().paragraphs.push(para);
    return this;
  }
  /** 이미지 추가 */
  addImage(data, format, opts) {
    const id = this.binDataIdCounter.next();
    const name = `image${id}.${format}`;
    this.doc.binData.push({ id, format, name, data });
    const pic = {
      binDataIDRef: id,
      width: mmToHwpunit(opts.width),
      height: mmToHwpunit(opts.height)
    };
    const para = {
      paraPrIDRef: 0,
      styleIDRef: 0,
      runs: [{ t: "picture", picture: pic, charPrIDRef: 0 }]
    };
    this.currentSection().paragraphs.push(para);
    return this;
  }
  /** 머리글/바닥글 설정 */
  setHeaderFooter(opts) {
    const def = this.currentSection().def;
    if (!def.headerFooter) def.headerFooter = {};
    if (opts.header !== void 0) {
      def.headerFooter.header = {
        paragraphs: [{
          paraPrIDRef: 0,
          styleIDRef: 0,
          runs: [{ t: "text", text: opts.header, charPrIDRef: 0 }]
        }]
      };
    }
    if (opts.footer !== void 0) {
      def.headerFooter.footer = {
        paragraphs: [{
          paraPrIDRef: 0,
          styleIDRef: 0,
          runs: [{ t: "text", text: opts.footer, charPrIDRef: 0 }]
        }]
      };
    }
    return this;
  }
  /** 다단 설정 */
  setColumns(opts) {
    const def = this.currentSection().def;
    def.columns = {
      type: opts.type || "NORMAL",
      count: opts.count,
      gap: mmToHwpunit(opts.gap ?? 10),
      sameSizes: true
    };
    return this;
  }
  /** 새 섹션 시작 */
  addSection() {
    this.doc.sections.push({
      def: createDefaultSectionDef(),
      paragraphs: []
    });
    return this;
  }
  /** 문서 빌드 */
  build() {
    return this.doc;
  }
  // ─── Internal ───
  currentSection() {
    return this.doc.sections[this.doc.sections.length - 1];
  }
  getOrCreateCharPr(style) {
    if (!style) return 0;
    const key = this.styleKey(style);
    const cached = this.charPrCache.get(key);
    if (cached !== void 0) return cached;
    const id = this.charPrIdCounter.next();
    const base = createDefaultCharProperty(id);
    if (style.fontSize !== void 0) base.height = ptToCharHeight(style.fontSize);
    if (style.bold !== void 0) base.bold = style.bold;
    if (style.italic !== void 0) base.italic = style.italic;
    if (style.color !== void 0) base.textColor = hexToColorref(style.color);
    if (style.underline) base.underline = "BOTTOM";
    if (style.strikeout) base.strikeout = "CONTINUOUS";
    if (style.fontName) {
      const fontIdx = this.ensureFont(style.fontName);
      base.fontRef = {
        hangul: fontIdx,
        latin: fontIdx,
        hanja: fontIdx,
        japanese: fontIdx,
        other: fontIdx,
        symbol: fontIdx,
        user: fontIdx
      };
    }
    this.doc.head.charProperties.push(base);
    this.charPrCache.set(key, id);
    return id;
  }
  ensureFont(fontName) {
    const faces = this.doc.head.fontFaces;
    const hangulFaces = faces.filter((f) => f.lang === "HANGUL");
    const existing = hangulFaces.findIndex((f) => f.fontName === fontName);
    if (existing !== -1) return existing;
    const newIdx = hangulFaces.length;
    const langs = [];
    const allLangs = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"];
    for (const lang of allLangs) {
      faces.push({ lang, fontName, fontType: "ttf" });
    }
    return newIdx;
  }
  getOrCreateTableBorderFill(lineType) {
    const line = {
      type: lineType,
      width: "0.12mm",
      color: hexToColorref("#000000")
    };
    const bf = {
      id: this.borderFillIdCounter.next(),
      borders: {
        left: { ...line },
        right: { ...line },
        top: { ...line },
        bottom: { ...line }
      }
    };
    this.doc.head.borderFills.push(bf);
    return bf.id;
  }
  styleKey(style) {
    return JSON.stringify({
      fs: style.fontSize,
      b: style.bold,
      i: style.italic,
      c: style.color,
      u: style.underline,
      s: style.strikeout,
      f: style.fontName
    });
  }
};
var utils_exports = {};
__export(utils_exports, {
  IdCounter: () => IdCounter,
  charHeightToPt: () => charHeightToPt,
  colorrefToHex: () => colorrefToHex,
  colorrefToRgbString: () => colorrefToRgbString,
  detectFormat: () => detectFormat,
  hexToColorref: () => hexToColorref,
  hwpunitToMm: () => hwpunitToMm,
  hwpunitToPt: () => hwpunitToPt,
  hwpunitToPx: () => hwpunitToPx,
  mmToHwpunit: () => mmToHwpunit,
  ptToCharHeight: () => ptToCharHeight,
  ptToHwpunit: () => ptToHwpunit,
  pxToHwpunit: () => pxToHwpunit,
  rgbToColorref: () => rgbToColorref
});
function write(doc, opts) {
  return writeHwpx(doc, opts);
}
function read(data, opts) {
  const format = detectFormat(data);
  if (format === "hwp5") {
    return readHwp5(data);
  }
  if (format === "unknown") {
    throw new HWPXError("Unknown file format. Expected HWPX or HWP5 file.");
  }
  return readHwpx(data, opts);
}
function writePdf2(doc, opts) {
  return writePdf(doc, opts);
}
export {
  HWPXBuilder,
  HWPXError,
  HWPXValidationError,
  createDefaultBorderFill,
  createDefaultCharProperty,
  createDefaultDocument,
  createDefaultFontFaces,
  createDefaultHead,
  createDefaultMeta,
  createDefaultParaProperty,
  createDefaultSectionDef,
  createDefaultStyles,
  read,
  utils_exports as utils,
  write,
  writePdf2 as writePdf
};
