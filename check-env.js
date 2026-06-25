const keys = Object.keys(process.env).filter(
  k => k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('PG') || k.includes('RAILWAY')
);
keys.forEach(k => console.log(k, '=', process.env[k]?.substring(0, 80)));
