# Fleet3D

Flotta- és járműkezelő szoftver: a napi flottakezelési teendők (határidők, átadás-átvétel, kárügyek, útnyilvántartás, gumicsere, számlák, riport) egy helyen, a járművek pedig telephelyenként 3D-ben, animált mozgással.

> **Állapot:** kattintható prototípus. Mintaadatokkal fut, backend még nincs mögötte.

## Mit tud a prototípus

A felület egy flottakezelési asszisztens napi munkájára épül (kb. 50 jármű, több telephely). Bal oldalt a menü, a piros számok a nyitott teendőket mutatják.

| Menüpont | Mire való |
| --- | --- |
| **Mai teendők** | Egy listában minden, amivel ma foglalkozni kell: lejárt vagy közelgő határidők, ellenőrizendő útnyilvántartások, hiányzó útnyilvántartások, számlák, bejelentetlen károk. Plusz közelgő időpontok és tevékenységnapló. |
| **Flotta térkép (3D)** | Telephelyenkénti 3D nézet. Áthelyezéskor a jármű animálva átmegy a másik telephelyre (egérrel áthúzva vagy gombbal). Kiadáskor kihajt a kapun, visszavételkor behajt és beparkol. Táblázatos nézet is van. |
| **Határidők** | Műszaki vizsga, KGFB, casco, autópálya-matrica, szerviz (dátum és km), üzemanyagkártya – sürgősség szerint. Telephelyenként összesítő emlékeztető levél a vezetőnek, időpontfoglalás, „elvégezve” rögzítése új érvényességgel, CSV export. |
| **Átadás-átvétel** | Kiadás kollégának és visszavétel: km-óra (nem lehet kevesebb a legutóbbinál), üzemanyagszint, tartozék-ellenőrzőlista, megjegyzés, aláírás. Nyomtatható jegyzőkönyv. |
| **Kárügyek** | Káresemény rögzítése, majd Rögzítve → Bejelentve → Javítás alatt → Lezárva. Kárbejelentő szöveg a biztosítónak (másolás, nyomtatás), kárszám, előzmények. |
| **Útnyilvántartás** | A havi útnyilvántartások automatikus ellenőrzése: km-folytonosság, hiányzó kiküldetési rendelvény (állítható km-határ felett), nem engedélyezett magánhasználat, hétvégi út, szokatlanul sok napi km. Elfogadás vagy visszaküldés javításra; bekérő levél a hiányzókhoz. |
| **Gumicsere** | Téli gumicsere-kampány telephelyenként: automatikus ütemezés a gumiszervizekhez napi kapacitással, hétvégék nélkül; foglalási levél a szerviznek; haladásjelző. |
| **Számlák** | Beérkező számlák ellenőrzése (ismeretlen rendszám, duplikáció, fizetési határidő, 300 000 Ft feletti jóváhagyás), kifogásolás, továbbítás a pénzügynek összesítő levéllel és CSV-vel. |
| **Vezetői riport** | KPI-k, telephelyenkénti bontás, költségek kategóriánként, legköltségesebb járművek. Nyomtatható / PDF riport és teljes járműnyilvántartás CSV-ben (Excelhez vagy MiniCRM-importhoz). |

További tudnivalók:

- **Mintaadatok:** 50 jármű négy telephelyen (Győr, Mosonmagyaróvár, Budapest, Debrecen), kitalált nevekkel, rendszámokkal és `pelda.hu` e-mail-címekkel. A határidők a mai naphoz igazodnak, és néhány hibát szándékosan tartalmaznak (lejárt műszaki, km-hiány az útnyilvántartásban, duplikált számla), hogy legyen mit ellenőrizni.
- **Mentés:** minden változás a böngészőben (localStorage) marad meg újratöltés után is. A menü alján a „Mintaadatok visszaállítása” mindent visszaállít.
- **Levelek:** az emlékeztetők, bekérők és továbbítások előre megírt levelek (másolás, vagy megnyitás a levelezőben). Éles rendszerben ezek automatikusan, ütemezve mennének ki.
- **Akadálymentesség és tartalék megoldás:** ha a gépen be van kapcsolva a csökkentett mozgás, nincs animáció; WebGL nélküli böngészőben táblázatos nézet jelenik meg. Amíg a térkép nincs a képernyőn, a 3D jelenet szünetel, és a közben indított kiadás/visszavétel animációja a térképre váltáskor fut le.

## Indítás

Node.js 20 vagy újabb kell hozzá.

```bash
npm install
```

```bash
npm run dev
```

Ezután nyisd meg a kiírt címet (általában `http://localhost:5173`).

Éles build (statikus fájlok a `dist/` mappába, bármilyen webszerverről kiszolgálható):

```bash
npm run build
```

## Technológia

| Réteg | Eszköz |
| --- | --- |
| Felület | React 19 + TypeScript, Vite |
| 3D | three.js, react-three-fiber, drei (`CameraControls`, `Html`, `RoundedBox`) |
| Állapot | Zustand |

A járműmodellek egyszerű alakzatokból, kódból épülnek (`src/scene/VehicleModel.tsx`), így nincs külső modellfájl és licencfüggőség. Később lecserélhetők saját `.glb` modellekre.

## Felépítés

```
src/
  data/
    types.ts          típusok (jármű, határidő, jegyzőkönyv, kárügy, útnyilvántartás, számla) és feliratok
    seed.ts           mintaadatok (50 jármű, telephelyek, útnyilvántartások, károk, számlák)
    logic.ts          határidő-számítás, útnyilvántartás- és számla-ellenőrzés, CSV, nyomtatás
    layout.ts         a sziget helyrendje, útvonalak (áthelyezés, kihajtás, behajtás)
  state/store.ts      alkalmazásállapot és műveletek, mentés a böngészőbe
  scene/
    FleetScene.tsx    vászon, fények, kamera, fogd és vidd vezérlés
    BranchIsland.tsx  telephely-sziget
    World.tsx         talaj, utak, körforgalom, fák
    VehicleActor.tsx  egy jármű mozgatása az útvonalon (előre, majd tolatva)
    VehicleModel.tsx  stilizált járműmodellek kategóriánként
  ui/
    MapPanels.tsx     a térkép oldalsávja, járműadatlap, táblázat, értesítések
    common.tsx        közös elemek (oldal, kártya, ablak, mezők, jelölők)
    modules/          Mai teendők, Határidők, Átadás-átvétel, Kárügyek, Útnyilvántartás, Gumicsere, Számlák, Riport
```

## Következő lépések

1. **Backend és közös adatbázis:** hogy többen dolgozhassanak ugyanazon az adaton; jogosultságok telephelyenként, SSO.
2. **Automatikus értesítések:** ütemezett e-mailek a határidőkről, hiányzó útnyilvántartásokról.
3. **Integrációk:** MiniCRM, tankkártya-tranzakciók (MOL/Shell/OMV), számlabefogadás (pl. NAV Online Számla), GPS és telematika.
4. **Dokumentumtár:** forgalmi engedély, biztosítási kötvény, kárfotók feltöltése és digitalizálása járművenként.
5. **Valós idejű frissítés:** WebSocket, hogy minden nyitott képernyőn egyszerre fusson le az animáció.
