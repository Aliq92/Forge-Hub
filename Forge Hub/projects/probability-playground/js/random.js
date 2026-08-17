/* random.js — pseudorandom number utilities shared by every lab.
   Two sources are supported: Math.random() (default) and
   crypto.getRandomValues() (opt-in "higher quality" mode). Neither is
   "true" hardware randomness; both are simulations. */
(function (global) {
  const PP = (global.PP = global.PP || {});

  let useCrypto = false;
  let cryptoBuf = null;
  let cryptoIdx = 1024;

  function refillCryptoBuf() {
    if (!cryptoBuf) cryptoBuf = new Uint32Array(1024);
    global.crypto.getRandomValues(cryptoBuf);
    cryptoIdx = 0;
  }

  function randFloat() {
    if (useCrypto && global.crypto && global.crypto.getRandomValues) {
      if (cryptoIdx >= 1024) refillCryptoBuf();
      const v = cryptoBuf[cryptoIdx++];
      return v / 4294967296;
    }
    return Math.random();
  }

  function setHighQuality(v) {
    useCrypto = !!v && !!(global.crypto && global.crypto.getRandomValues);
  }
  function isHighQuality() {
    return useCrypto;
  }

  function randInt(min, max) {
    return Math.floor(randFloat() * (max - min + 1)) + min;
  }

  function chance(p) {
    return randFloat() < p;
  }

  function pickWeighted(items) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    if (total <= 0) return items[0] && items[0].value;
    let r = randFloat() * total;
    for (const it of items) {
      r -= it.weight;
      if (r < 0) return it.value;
    }
    return items[items.length - 1].value;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(randFloat() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  PP.random = { randFloat, randInt, chance, pickWeighted, shuffle, setHighQuality, isHighQuality };
})(window);
