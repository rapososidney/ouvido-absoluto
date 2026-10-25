# Ouvido Absoluto

Treinador de ouvido absoluto do Sidney (educador musical, SESI-SP). Um único arquivo HTML (`index.html`), publicado pelo GitHub Pages e usado no celular (Android, Chrome) como app instalado. Responda e escreva comentários em **português do Brasil**, de forma direta e técnica.

- Site: `https://rapososidney.github.io/ouvido-absoluto/`
- Publicar = `git push` na `main`. O Pages leva 1–2 min, e o navegador pode manter respostas em cache por até 10 min (para conferir antes disso, use `?v=N` na URL).
- Faça commit só quando o Sidney pedir. Mensagens de commit em português.

## Regras do repositório

- **Tudo no `index.html`, sem dependências externas**: sem CDN, sem build. Tem que abrir offline.
- **Arquivos do app instalável**: `manifest.webmanifest` (`id`, `start_url` e `scope` = `./`, ou seja, só esta pasta do repositório), `sw.js` (registrado sem escopo explícito, e portanto com escopo nesta pasta) e os ícones `icon-192.png`, `icon-512.png` e `icon-512-maskable.png`. Não mude `id` nem `start_url`: o celular identifica o app instalado por eles.
- Ao adicionar arquivos ao cache, inclua-os em `ARQS` no `sw.js` e troque a versão de `CACHE`. A página usa rede primeiro, então uma mudança só no `index.html` chega sem trocar a versão.
- Este projeto veio do repositório antigo `Quizes-Musicais-Teste` (em processo de aposentadoria). As regras comuns a todos os projetos estão no `CLAUDE.md` da pasta acima.

## O app (index.html)

Protocolo baseado em Wong et al. (2020; Psychon. Bull. Rev. 2024) e Van Hedger, Heald & Nusbaum (2019, PLOS ONE): treino de nomeação com progressão de notas, várias oitavas e timbres, tempo-limite e feedback imediato.

### Abas
- **Diagnóstico**: memória de gravações (teste de Levitin: canta a 1ª nota de uma gravação conhecida e compara, em cents, por YIN) e produção pelo nome (canta a nota pedida). Resultado com p-valor binomial contra o acaso.
- **Treino**: blocos de 40 notas. Começa com Mi, Fá, Fá♯ (`ORDEM=[4,5,6,7,3,8,2,9,1,10,0,11]`). Nova nota quando houver 2 blocos seguidos com ≥ 90% e tempo mediano ≤ 3 s. Nota nova tem peso 2 no sorteio.
- **Teste**: 48 notas (12 × 4), três oitavas, metade em **órgão (timbre que nunca aparece no treino)**, sem feedback, erro de semitom conta como erro.
- **Progresso**: veredito. SIM = ≥ 90% exato e ≥ 90% no órgão, mantido num teste ≥ 28 dias depois. NÃO = platô (ganho < 5 pontos em 3 testes depois de 30 h) com ≥ 60 h de treino. Senão, "Em aberto".
- **Ajustes**: nomes (Dó/C), botões ou teclado de uma oitava, tempo-limite, máscara, timbres, voz, vocabulário, exportar/importar.

### Regras que não podem ser quebradas (validade do treino)
- **Lá = 440 Hz sempre.**
- **Nenhum som com altura definida fora do estímulo**: confirmações são rajadas de ruído (`ruidoCurto`, `bipOk`, `bipErro`, `bipDuvida`). Um bipe afinado viraria nota de referência e permitiria ouvido relativo.
- **Máscara entre notas** (nuvem microtonal ou ruído) para apagar a nota anterior.
- **O órgão fica reservado ao Teste.**
- Por isso o reconhecimento de voz **não usa a Web Speech API**: no Android ela toca um bipe afinado a cada início de escuta.

### Áudio
- Piano: aditivo com inarmonicidade. Violão e ukulele: Karplus-Strong em buffer; o atraso efetivo é `L−0,5`, por isso `L=floor(sr/f+0,5)`, `f0=sr/(L−0,5)` e `playbackRate=f/f0` (afinação exata, < 0,2 cent; testado em 44,1 e 48 kHz). Ukulele não toca na oitava 3.

### Resposta por voz (reconhecimento próprio, offline)
- Captura contínua: `getUserMedia` (eco e ruído ON, AGC OFF) → passa-alta 150 Hz → `ScriptProcessor(1024)` → histórico de 6 s em `MIC.hist`.
- Detecção de fala por energia relativa ao piso de ruído (`vozSens`, padrão 4×), início em 2 blocos, fim após ~300 ms abaixo, máximo de 2,2 s.
- `sondar()` mede o piso no silêncio após a máscara e detecta vazamento do alto-falante no microfone. Se houver vazamento, só escuta depois que a nota termina (+1450 ms).
- `temVoz()`: exige ≥ 3 quadros com altura (YIN, limiar 0,25, 70–600 Hz). Ruído sem voz é ignorado em silêncio.
- Atributos: MFCC 12 (26 filtros mel, 80–5000 Hz) + Δ, CMN, corte de silêncio a −35 dB. Classificação: DTW (banda 50%, normalizado por n+m), média das 2 melhores gravações por classe. Rejeita se a distância for maior que `VZ.limiar` (p90 intra-classe × 1,5) ou se a razão melhor/segunda for ≥ 0,93.
- Classes 0–11 = notas, 12 = "parar". No treino só as notas liberadas e "parar" são candidatas.
- **Falas de correção**: a gravação medoide de cada nota é guardada a 16 kHz (Int16 em base64) e tocada pelo Web Audio, porque a `speechSynthesis` pausa com a tela bloqueada. As falas que faltarem são preenchidas com acertos por voz.
- **Modo bolso**: tela preta que bloqueia todos os toques. Destrava segurando o cadeado 2 s e depois tocando um alvo sorteado. `history.pushState` segura o gesto de voltar.

### Armazenamento (manter compatível: o Sidney tem dados reais)
- `localStorage['ouvidoAbsoluto_v1']`: estado (`cfg`, `nivel`, `blocosOk`, `treinoMs`, `recentes`, `sessoes`, `testes`, `levitin`, `producao`). `carregar()` mescla com `novoEstado()`; campos novos de `cfg` entram com valor padrão em `novoEstado()`.
- `localStorage['ouvidoAbsoluto_voz_v1']`: vocabulário (`tpl` com MFCC arredondado, `limiar`, `loo`, `conf`, `clips`), cerca de 600 KB.
- Os dois ficam na origem `rapososidney.github.io`, que é compartilhada com os outros repositórios do Sidney (afinadores, quizzes). Nunca use `localStorage.clear()` nem chaves genéricas; sempre o prefixo `ouvidoAbsoluto_`.

## Testes (rode depois de qualquer mudança no index.html)

```
node testes/motor.test.js          # YIN, Karplus-Strong, estatística, reconhecimento e detecção de voz
python testes/navegador.test.py    # ponta a ponta no Chromium com microfone simulado (~2 min)
```

O teste de navegador precisa de `pip install playwright` e `python -m playwright install chromium` na primeira vez. As palavras de teste são sintetizadas por formantes (`testes/sint.js`) e variam mais que uma voz real. Os testes conferem o funcionamento, não a precisão com a voz do Sidney.
