# Teste de ponta a ponta no Chromium (Playwright), com microfone simulado.
# Uso (na raiz do repositório):
#   pip install playwright && python -m playwright install chromium   (só na primeira vez)
#   python testes/navegador.test.py
# O microfone é substituído por um gerador que "fala" palavras sintéticas (testes/sint.js).
# Cobre: gravação e verificação do vocabulário, treino por voz com ruído de atrito antes de cada
# resposta, tela "bloqueada" (document.hidden), falas de correção, comando "parar" e modo bolso.
import asyncio, json, pathlib, sys, time
from playwright.async_api import async_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
URL = (RAIZ / 'index.html').as_uri()
SINT = (RAIZ / 'testes' / 'sint.js').read_text(encoding='utf-8')
INIT = SINT + r"""
window.__nomes={'Dó':0,'Dó♯':1,'Ré':2,'Ré♯':3,'Mi':4,'Fá':5,'Fá♯':6,'Sol':7,'Sol♯':8,'Lá':9,'Lá♯':10,'Si':11,'Parar':12};
window.__tocadas=[];
navigator.mediaDevices.getUserMedia=async()=>{
  if(!window.__ctx){window.__ctx=new AudioContext();window.__dest=window.__ctx.createMediaStreamDestination();
    const n=window.__ctx.createBuffer(1,48000,window.__ctx.sampleRate),d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*0.0015;
    const s=window.__ctx.createBufferSource();s.buffer=n;s.loop=true;s.connect(window.__dest);s.start();}
  return window.__dest.stream;
};
window.__falar=c=>{const x=sintetizar(c,window.__ctx.sampleRate),b=window.__ctx.createBuffer(1,x.length,window.__ctx.sampleRate);b.copyToChannel(x,0);
  const s=window.__ctx.createBufferSource();s.buffer=b;s.connect(window.__dest);s.start();};
window.__atrito=()=>{const c=window.__ctx,n=Math.floor(c.sampleRate*0.5),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);let br=0;
  for(let i=0;i<n;i++){br=0.995*br+(Math.random()*2-1)*0.05;d[i]=br*3;}const s=c.createBufferSource();s.buffer=b;s.connect(window.__dest);s.start();};
window.alert=m=>console.log('ALERT',m);window.confirm=()=>true;
"""
ESPIAO = """()=>{const o=tocar;window.tocar=function(m){window.__tocadas.push(m%12);return o.apply(this,arguments);};}"""
falhas = []
def conferir(ok, msg):
    print(('  ok    ' if ok else '  FALHA ') + msg)
    if not ok: falhas.append(msg)

async def responder_prompts(pg, ate_s=240):
    visto, t0 = None, time.time()
    while time.time() - t0 < ate_s:
        st = await pg.evaluate("()=>({run:!$('#vzRun').classList.contains('oculto'),prog:$('#vzProg').textContent,alvo:$('#vzAlvo').textContent,st:$('#vzSt').textContent})")
        if not st['run']: return True
        if st['st'] == 'Fale agora.' and st['prog'] != visto:
            visto = st['prog']; await asyncio.sleep(0.6)
            await pg.evaluate(f"()=>__falar(__nomes[{json.dumps(st['alvo'])}])")
        await asyncio.sleep(0.1)
    return False

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 800}, has_touch=True)
        pg = await ctx.new_page(); erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)))
        await pg.add_init_script(INIT); await pg.goto(URL); await pg.evaluate(ESPIAO)
        for t in ['treino', 'teste', 'prog', 'cfg', 'diag']: await pg.click(f'#tabs button[data-t="{t}"]')

        print('Vocabulário')
        await pg.click('#tabs button[data-t="cfg"]'); await pg.select_option('#cResp', 'voz')
        await pg.uncheck('#cBolso')
        await pg.click('#vzGravar'); conferir(await responder_prompts(pg), 'gravação terminou')
        conferir(await pg.evaluate("()=>VZ.tpl.length")==39, '39 gravações')
        conferir(await pg.evaluate("()=>Object.keys(VZ.clips).length")==12, '12 falas de correção')
        await pg.click('#vzVerif'); await responder_prompts(pg)
        txt = await pg.inner_text('#vzRes'); ok = int(txt.split('Verificação: ')[1].split('/')[0])
        conferir(ok >= 11, f'verificação {ok}/13')

        print('Treino por voz (ruído antes de cada resposta, tela "bloqueada")')
        await pg.evaluate("""()=>{Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});
          window.__clip=0;window.__tts=0;const oc=tocarClip;window.tocarClip=function(){__clip++;return oc.apply(this,arguments);};
          speechSynthesis.speak=u=>{__tts++;};}""")
        await pg.click('#tabs button[data-t="treino"]'); await pg.click('#trIni')
        fb = []; resp = 0
        while resp < 7:
            if await pg.evaluate("()=>!$('#trGrade').classList.contains('espera')"):
                await asyncio.sleep(0.3); pc = await pg.evaluate("()=>__tocadas[__tocadas.length-1]")
                alvo = 12 if resp == 6 else ([5, 6, 4][[4, 5, 6].index(pc)] if resp in (1, 3) else pc)
                await pg.evaluate("()=>__atrito()"); await asyncio.sleep(0.9)
                await pg.evaluate(f"()=>__falar({alvo})"); resp += 1
                while not await pg.evaluate("()=>$('#trGrade').classList.contains('espera')"): await asyncio.sleep(0.05)
                await asyncio.sleep(0.15); fb.append(await pg.inner_text('#trFb'))
            await asyncio.sleep(0.05)
        await asyncio.sleep(2)
        print('   ', fb)
        conferir(sum(f.startswith('✓') for f in fb) == 4, 'acertos reconhecidos (4)')
        conferir(sum('ouvi' in f for f in fb) == 2, 'erros propositais reconhecidos (2)')
        conferir(await pg.evaluate('()=>__clip') == 2 and await pg.evaluate('()=>__tts') == 0, 'correção na voz gravada, sem voz sintética com a tela bloqueada')
        conferir('interrompido' in await pg.inner_text('#trSum'), '"parar" encerrou o bloco')

        print('Modo bolso')
        await pg.click('#trIni'); await pg.evaluate("travarBolso()"); run0 = await pg.evaluate("RUN")
        while await pg.evaluate("()=>$('#trGrade').classList.contains('espera')"): await asyncio.sleep(0.05)
        for sel in ['#trGrade .nota', '#tabs button', '#trStop']:
            for el in await pg.query_selector_all(sel):
                bb = await el.bounding_box()
                if bb: await pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
        conferir(run0 == await pg.evaluate("RUN") and await pg.is_visible('#trRun'), 'toques não param o treino')
        bb = await (await pg.query_selector('#bolsoTrava')).bounding_box(); cx, cy = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
        await pg.mouse.move(cx, cy); await pg.mouse.down(); await asyncio.sleep(1.0); await pg.mouse.up()
        conferir(await pg.is_visible('#bolso') and not await pg.is_visible('#bolso2'), 'segurar 1 s não destrava')
        await pg.mouse.down(); await asyncio.sleep(2.2); await pg.mouse.up()
        ab = await (await pg.query_selector('#bolso2')).bounding_box(); await pg.touchscreen.tap(ab['x'] + 40, ab['y'] + 40)
        conferir(not await pg.is_visible('#bolso'), 'segurar 2 s + tocar o alvo destrava')
        await pg.evaluate("pararTudo()")

        conferir(not erros, 'sem erros de JavaScript' + ('' if not erros else ': ' + '; '.join(erros)))
        await b.close()
    print(f'\n{len(falhas)} FALHA(S)' if falhas else '\nTudo certo.')
    sys.exit(1 if falhas else 0)

asyncio.run(main())
