# Fleet3D

Flotta- és járműkezelő szoftver, amely a járműveket telephelyenként (branchenként) 3D-ben mutatja, és animálja, amikor egy jármű egyik telephelyről a másikra kerül.

> **Állapot:** kattintható prototípus. Mintaadatokkal fut, backend még nincs mögötte.

## Mit tud a prototípus

- **3D áttekintés:** négy telephely-sziget garázzsal, parkolóhelyekkel, kapuval és sorompóval; a telephelyeket utak kötik össze egy körforgalmon keresztül.
- **Áthelyezés animációval:** a jármű kiáll a helyéről, kihajt a kapun, megkerüli a körforgalmat, behajt a cél telephelyre, és betolat egy szabad helyre. A kerekek forognak, a sorompó felnyílik.
- **Áthelyezés kétféleképpen:**
  - **fogd és vidd:** a járművet egérrel áthúzod egy másik telephelyre (a cél kiemelve látszik);
  - **gombbal:** a jobb oldali adatlapon.
- **Állapotjelzők:** 🔧 szervizben, **!** lejáró okmány, áttetsző jármű: kivonva, narancs gyűrű: úton.
- **Könnyen tanulható felület:** telephelyenkénti lista kereséssel, járműadatlap, mozgásnapló, táblázatos nézet ugyanazokkal az adatokkal, rövid bemutató az első belépéskor.
- **Élő szimuláció:** kapcsolóval véletlenszerű áthelyezések indulnak, mintha más felhasználók is dolgoznának.
- **Akadálymentesség és tartalék megoldás:** ha a gépen a csökkentett mozgás be van kapcsolva, az áthelyezés animáció nélkül, azonnal történik; ha a böngésző nem tud WebGL-t, táblázatos nézet jelenik meg.

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
    types.ts          típusok (telephely, jármű, mozgás) és magyar feliratok
    seed.ts           minta telephelyek és járművek
    layout.ts         a sziget helyrendje, koordináta-átszámítás, útvonaltervezés
  state/store.ts      alkalmazásállapot: áthelyezés, szabad hely keresése, mozgásnapló
  scene/
    FleetScene.tsx    vászon, fények, kamera, fogd és vidd vezérlés
    BranchIsland.tsx  telephely-sziget
    World.tsx         talaj, utak, körforgalom, fák
    VehicleActor.tsx  egy jármű mozgatása az útvonalon (előre, majd tolatva)
    VehicleModel.tsx  stilizált járműmodellek kategóriánként
  ui/Panels.tsx       felső sáv, oldalsáv, adatlap, táblázat, értesítések, bemutató
```

## Következő lépések

1. **Backend és adatmodell:** API, `vehicle_movements` mozgásnapló (tervezett / úton / megérkezett), jogosultságok telephelyenként, SSO.
2. **Valós idejű frissítés:** WebSocket, hogy minden nyitott képernyőn egyszerre fusson le az animáció.
3. **Idővonal:** a nap vagy a hét mozgásainak visszajátszása.
4. **Integrációk:** GPS és telematika, tankkártya, ERP.
