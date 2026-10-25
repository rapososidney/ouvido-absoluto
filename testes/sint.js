// síntese por formantes de palavras aproximadas (para teste)
const V={a:[750,1300,2600],e:[550,1800,2500],i:[300,2300,3000],o:[550,850,2500],u:[320,800,2400],m:[250,1200,2500],l:[350,1100,2600],w:[350,700,2400]};
const S=(d)=>({t:'n',lo:4000,hi:8000,d,g:.25}), F=(d)=>({t:'n',lo:1200,hi:7000,d,g:.1}), Hh=(d)=>({t:'n',lo:300,hi:1600,d,g:.2}), P=(d)=>({t:'z',d}), v=(k,d,g=1)=>({t:'v',F:V[k],d,g});
const SUS=[S(90),v('u',90),S(110)];
const PALAVRAS=[
 [P(30),v('o',220)], [P(30),v('o',150),...SUS], [Hh(80),v('e',220)], [Hh(80),v('e',140),...SUS],
 [v('m',80,.4),v('i',220)], [F(100),v('a',220)], [F(100),v('a',140),...SUS], [S(110),v('o',160),v('w',90,.7)],
 [S(110),v('o',120),v('w',60,.7),...SUS], [v('l',70,.5),v('a',220)], [v('l',70,.5),v('a',140),...SUS], [S(110),v('i',200)],
 [P(30),v('a',120),P(20),v('a',120),Hh(60)]];
function sintetizar(c,sr,R=Math.random){
  const esc=0.8+0.4*R(),fesc=0.95+0.1*R(),f0=95+55*R(),amp=0.3+0.7*R(),segs=PALAVRAS[c].map(s=>({...s,d:s.d*esc*(0.9+0.2*R())}));
  const N=Math.floor(sr*(segs.reduce((a,s)=>a+s.d,0)/1000+0.3)),x=new Float64Array(N);let n=Math.floor(sr*0.15),fase=0;
  const st=[[0,0],[0,0],[0,0]];let prevF=null;const res=(y,F,BW,s)=>{const r=Math.exp(-Math.PI*BW/sr),b=2*r*Math.cos(2*Math.PI*F/sr),cc=-r*r,a=1-b-cc,o=a*y+b*s[0]+cc*s[1];s[1]=s[0];s[0]=o;return o;};
  const ns=[0,0];
  for(const s of segs){const L=Math.floor(sr*s.d/1000);
    for(let k=0;k<L&&n<N;k++,n++){
      if(s.t==='v'){const al=Math.min(1,k/(sr*0.04)),Ft=s.F.map(f=>f*fesc),Fc=prevF?Ft.map((f,i)=>prevF[i]+(f-prevF[i])*al):Ft;
        const f=f0*(1+0.01*Math.sin(n/sr*30));fase+=f/sr;let e=0;if(fase>=1){fase-=1;e=1;}
        let y=e*s.g;[80,100,150].forEach((bw,i)=>{y=res(y,Fc[i],bw,st[i]);});x[n]+=y*3;
        if(k===L-1)prevF=Ft;}
      else if(s.t==='n'){let y=(R()*2-1)*s.g;const fc=(s.lo+s.hi)/2;y=res(y,fc,s.hi-s.lo,ns);x[n]+=y;prevF=null;}
      else prevF=null;
    }}
  let mx=0;for(let i=0;i<N;i++)mx=Math.max(mx,Math.abs(x[i]));
  const out=new Float32Array(N);for(let i=0;i<N;i++)out[i]=x[i]/mx*0.5*amp+(R()*2-1)*0.002;return out;
}
if(typeof module!=='undefined')module.exports={sintetizar,PALAVRAS};
