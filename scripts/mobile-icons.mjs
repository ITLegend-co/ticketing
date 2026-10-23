import {writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
function crc32(data){let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([n,t,data,crc]);}
const size=180,raw=Buffer.alloc(size*(1+size*4));
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const px=x/size*512,py=y/size*512,r=Math.hypot(px-256,py-240);
  const white=(py<=280&&py>=88&&r>=120&&r<=152)||
    (px>=96&&px<=166&&py>=246&&py<=366)||(px>=346&&px<=416&&py>=246&&py<=366)||
    (px>=368&&px<=392&&py>=350&&py<=400)||(px>=268&&px<=380&&py>=400&&py<=424);
  const i=y*(size*4+1)+1+x*4;raw.set(white?[255,255,255,255]:[37,99,235,255],i);
}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
await writeFile(new URL('../dist/apple-touch-icon.png',import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
