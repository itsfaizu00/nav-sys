/**
 * ═══════════════════════════════════════════════════════════
 *  INTEGRAL UNIVERSITY — Campus Navigator  |  script.js
 *  v3 — Road network hand-traced from OSM white roads
 *
 *  FROM THE SCREENSHOT we can identify these white roads:
 *
 *  ROAD A — Main diagonal internal road (NW→SE)
 *    Enters at Gate 2 (NW), runs diagonally SE through
 *    campus, passes between buildings. This is the
 *    PRIMARY campus spine road visible as wide white line.
 *    Approx bearing: goes from lat 26.9592,lng 80.9990
 *    down-right to lat 26.9572, lng 81.0015
 *
 *  ROAD B — Horizontal road (W-E), upper campus
 *    Runs roughly east-west across top of campus,
 *    connects diagonal road to east side.
 *    Lat ~26.9584, lng 80.9993 → 81.0022
 *
 *  ROAD C — Horizontal road (W-E), lower/middle campus
 *    Runs east-west across lower half, lat ~26.9575
 *    This is the road Auditorium/Library/OPD face.
 *    lng 80.9993 → 81.0015
 *
 *  ROAD D — Short internal N-S connectors
 *    Several short N-S paths connecting Road B and Road C
 *
 *  ROAD E — Gate 1 access road
 *    Gate 1 is on west side, has a short road connecting
 *    into the campus diagonal / main spine.
 *
 *  KEY INSIGHT from screenshot:
 *  The diagonal road is the MAIN artery. All other roads
 *  branch off from it. Routes must use this diagonal,
 *  NOT Kursi Road which is outside campus.
 *
 *  To prevent routing on Kursi Road: all nodes are placed
 *  INSIDE campus bounds (east of lng 80.9985).
 * ═══════════════════════════════════════════════════════════
 */

// ────────────────────────────────────────────────────────────
// 0. AUTHENTICATION & SESSION MANAGEMENT
// ────────────────────────────────────────────────────────────
class AuthManager {
  constructor() {
    this.user = null;
    this.token = null;
    this.checkSession();
  }

  checkSession() {
    const storedUser = localStorage.getItem('nav_sys_user');
    const storedToken = localStorage.getItem('nav_sys_token');

    if (!storedUser || !storedToken) {
      this.redirectToLogin();
      return false;
    }

    try {
      this.user = JSON.parse(storedUser);
      this.token = storedToken;
      return true;
    } catch (e) {
      // Session data corrupted, logout
      this.logout();
      return false;
    }
  }

  redirectToLogin() {
    const loginWall = document.getElementById('login-wall');
    if (loginWall) {
      loginWall.classList.remove('hidden');
    }
    setTimeout(() => {
      sessionStorage.setItem('redirect_after_login', window.location.pathname.split('/').pop() || 'app.html');
      window.location.href = 'index.html';
    }, 500);
  }

  logout() {
    localStorage.removeItem('nav_sys_user');
    localStorage.removeItem('nav_sys_token');
    localStorage.removeItem('nav_sys_timestamp');
    window.location.href = 'index.html';
  }

  getUser() {
    return this.user;
  }

  isAuthenticated() {
    return this.user !== null && this.token !== null;
  }
}

// Initialize auth manager and enforce authentication before loading the map.
const authManager = new AuthManager();

// ────────────────────────────────────────────────────────────
// 1. CAMPUS LOCATIONS
// ────────────────────────────────────────────────────────────
const LOCATIONS = [
  { id: "gate1",           name: "Gate 1",             lat: 26.958337, lng: 80.998040 },
  { id: "gate2",           name: "Gate 2",              lat: 26.959177, lng: 80.998957 },
  { id: "mosque",          name: "Integral Mosque",     lat: 26.957747, lng: 80.998064 },
  { id: "lawn",            name: "Lawn",                lat: 26.957744, lng: 80.998544 },
  { id: "a_block",         name: "A Block",             lat: 26.957889, lng: 80.998045 },
  { id: "b_block",         name: "B Block",             lat: 26.958108, lng: 80.999044 },
  { id: "canteen",         name: "Canteen",             lat: 26.957452, lng: 80.999202 },
  { id: "d_block",         name: "D Block",             lat: 26.957193, lng: 80.999438 },
  { id: "auditorium",      name: "Auditorium",          lat: 26.957624, lng: 80.999788 },
  { id: "central_library", name: "Central Library",     lat: 26.957692, lng: 81.000028 },
  { id: "e_block",         name: "E Block",             lat: 26.957178, lng: 81.000316 },
  { id: "f_block",         name: "F Block",             lat: 26.957570, lng: 81.000523 },
  { id: "opd",             name: "OPD Building",        lat: 26.957721, lng: 81.000833 },
  { id: "ground",          name: "Ground",              lat: 26.956979, lng: 81.001433 },
  { id: "parking",         name: "University Parking",  lat: 26.95882774298993, lng: 81.00015000000000 },
  { id: "gym",             name: "Campus Gym",          lat: 26.958642, lng: 81.000277 },
  { id: "medical_block",   name: "Medical Block",       lat: 26.958290, lng: 81.001097 },
  { id: "hospital",        name: "Integral Hospital",   lat: 26.958187, lng: 81.002097 },
];


// ────────────────────────────────────────────────────────────
// 2. ROAD NODES — traced from white roads in OSM screenshot
//
//  The campus road system (from screenshot) consists of:
//
//  ① DIAGONAL SPINE — wide white road going NW↔SE
//     Enters campus at Gate2, curves inward, runs to SE corner
//     This is the main artery. ALL buildings connect to it.
//
//  ② UPPER HORIZONTAL — east-west road in upper campus
//     Branches east from diagonal at ~lat 26.9584
//     Serves: B Block, Gym, Medical Block, Hospital
//
//  ③ LOWER HORIZONTAL — east-west road in lower campus
//     Branches east from diagonal at ~lat 26.9575
//     Serves: Canteen, Auditorium, Library, F Block, OPD
//
//  ④ SOUTH PERIMETER — road along south edge
//     Serves: D Block, E Block, Ground
//
//  ⑤ N-S CONNECTORS — short roads linking upper↔lower rows
//
//  ⑥ GATE 1 SPUR — short road from Gate1 into campus
//     Gate1 connects to the diagonal spine via a spur
// ────────────────────────────────────────────────────────────
const NODES = {

  // ═══════════════════════════════════════
  // ① DIAGONAL SPINE ROAD
  //   Hand-traced from OSM: the main white
  //   diagonal road visible in screenshot.
  //   Runs from Gate2 (NW) curving SE into campus.
  //   Coords step by ~50–70m along the road line.
  // ═══════════════════════════════════════

  // Gate 2 — NW corner entry
  gate2:  { lat: 26.959177, lng: 80.998957 },

  // Diagonal going south-east from Gate 2
  // (Each node ~60m apart along the visible road)
  D01:    { lat: 26.959070, lng: 80.999060 },
  D02:    { lat: 26.958960, lng: 80.999160 },
  D03:    { lat: 26.958850, lng: 80.999270 },  // starts turning more south
  D04:    { lat: 26.958760, lng: 80.999390 },
  D05:    { lat: 26.958680, lng: 80.999520 },  // upper-horizontal junction area
  D06:    { lat: 26.958600, lng: 80.999650 },
  D07:    { lat: 26.958510, lng: 80.999780 },
  D08:    { lat: 26.958410, lng: 80.999880 },
  D09:    { lat: 26.958300, lng: 80.999960 },
  D10:    { lat: 26.958190, lng: 81.000030 },
  D11:    { lat: 26.958080, lng: 81.000090 },  // middle junction area
  D12:    { lat: 26.957960, lng: 81.000150 },
  D13:    { lat: 26.957840, lng: 81.000210 },
  D14:    { lat: 26.957720, lng: 81.000250 },  // lower junction area
  D15:    { lat: 26.957600, lng: 81.000290 },
  D16:    { lat: 26.957480, lng: 81.000330 },
  D17:    { lat: 26.957360, lng: 81.000380 },  // south-east end of diagonal

  // ═══════════════════════════════════════
  // Gate 1 SPUR
  //   Gate 1 is on the west side. A short internal
  //   road connects it eastward to the diagonal spine.
  //   From screenshot: Gate1 connects via road that goes
  //   east/north-east to hit the diagonal near D05–D07.
  // ═══════════════════════════════════════
  gate1:  { lat: 26.958337, lng: 80.998040 },
  G1A:    { lat: 26.958337, lng: 80.998300 },  // go east from gate1
  G1B:    { lat: 26.958337, lng: 80.998600 },
  G1C:    { lat: 26.958390, lng: 80.998900 },  // curve NE to hit diagonal
  G1D:    { lat: 26.958450, lng: 80.999200 },  // joins diagonal near D04/D05

  // ═══════════════════════════════════════
  // Mosque / A Block SPUR
  //   South of Gate1, short roads serve mosque & a_block.
  //   From Gate1 spur G1A, go south along west edge.
  // ═══════════════════════════════════════
  G1S1:   { lat: 26.958100, lng: 80.998200 },  // south from G1B area
  G1S2:   { lat: 26.957950, lng: 80.998150 },
  G1S3:   { lat: 26.957800, lng: 80.998100 },  // a_block / lawn level
  G1S4:   { lat: 26.957650, lng: 80.998080 },  // mosque level

  a_block: { lat: 26.957889, lng: 80.998045 },
  mosque:  { lat: 26.957747, lng: 80.998064 },
  lawn:    { lat: 26.957744, lng: 80.998544 },

  // Lawn is east of mosque; short path east
  LW1:    { lat: 26.957750, lng: 80.998300 },  // from G1S4 east to lawn

  // ═══════════════════════════════════════
  // ② UPPER HORIZONTAL ROAD
  //   East-west road at lat ~26.9585
  //   Branches from diagonal around D05 junction,
  //   runs east serving B Block, Parking, Gym, Medical
  // ═══════════════════════════════════════

  // Junction on diagonal where upper-H branches
  UH_JN:  { lat: 26.958650, lng: 80.999500 },  // on diagonal ~D05/D06

  UH1:    { lat: 26.958620, lng: 80.999200 },  // goes west toward Gate1 road
  UH2:    { lat: 26.958580, lng: 80.999000 },  // B Block north
  UH3:    { lat: 26.958550, lng: 80.998800 },  // close to G1C
  UH4:    { lat: 26.958580, lng: 81.000700 },  // east of junction
  UH5:    { lat: 26.958560, lng: 81.001000 },
  UH6:    { lat: 26.958530, lng: 81.001300 },  // Medical Block area
  UH7:    { lat: 26.958500, lng: 81.001600 },
  UH8:    { lat: 26.958470, lng: 81.001900 },  // Hospital east

  // Parking approaches from north via Gate2
  parking: { lat: 26.95882774298993, lng: 81.00015000000000 },
  PK1:    { lat: 26.959050, lng: 80.999100 },
  PK2:    { lat: 26.958850, lng: 80.999100 },
  PK3:    { lat: 26.958650, lng: 80.999300 },  // joins diagonal / UH_JN area

  // B Block faces north/upper road
  b_block: { lat: 26.958108, lng: 80.999044 },
  BB1:    { lat: 26.958380, lng: 80.999044 },  // stub from B Block to upper road

  // Gym stub from upper road
  gym:    { lat: 26.958642, lng: 81.000277 },
  GM1:    { lat: 26.958620, lng: 81.000277 },  // on upper road

  // Medical Block stub
  medical_block: { lat: 26.958290, lng: 81.001097 },
  MB1:    { lat: 26.958450, lng: 81.001100 },  // on upper road near UH6

  // Hospital
  hospital: { lat: 26.958187, lng: 81.002097 },
  HP1:    { lat: 26.958390, lng: 81.002000 },  // on upper road east end
  HP2:    { lat: 26.958250, lng: 81.002050 },  // stub south to hospital

  // ═══════════════════════════════════════
  // ③ LOWER HORIZONTAL ROAD
  //   East-west road at lat ~26.9576
  //   Branches from diagonal around D14–D16 area,
  //   runs west serving Canteen, and east serving
  //   Auditorium, Library, F Block, OPD
  // ═══════════════════════════════════════

  // Junction on diagonal where lower-H branches
  LH_JN:  { lat: 26.957680, lng: 81.000240 },  // on diagonal ~D14

  // West arm: toward Canteen, Lawn area
  LH_W1:  { lat: 26.957650, lng: 80.999950 },
  LH_W2:  { lat: 26.957620, lng: 80.999650 },
  LH_W3:  { lat: 26.957590, lng: 80.999350 },
  LH_W4:  { lat: 26.957560, lng: 80.999100 },  // Canteen north
  LH_W5:  { lat: 26.957530, lng: 80.998850 },  // west end of lower road
  LH_W6:  { lat: 26.957500, lng: 80.998600 },  // joins west spur

  // East arm: Library, F Block, OPD
  LH_E1:  { lat: 26.957710, lng: 81.000500 },
  LH_E2:  { lat: 26.957730, lng: 81.000800 },  // OPD level
  LH_E3:  { lat: 26.957750, lng: 81.001100 },

  // Building stubs from lower road
  canteen:         { lat: 26.957452, lng: 80.999202 },
  auditorium:      { lat: 26.957624, lng: 80.999788 },
  central_library: { lat: 26.957692, lng: 81.000028 },
  f_block:         { lat: 26.957570, lng: 81.000523 },
  opd:             { lat: 26.957721, lng: 81.000833 },

  // Auditorium stub up to lower road
  AU1:    { lat: 26.957630, lng: 80.999790 },  // basically on road

  // Library stub
  CL1:    { lat: 26.957695, lng: 81.000030 },  // basically on road

  // F Block stub south of lower road
  FB1:    { lat: 26.957580, lng: 81.000520 },  // on lower road

  // OPD stub
  OPD1:   { lat: 26.957730, lng: 81.000830 },  // on lower road

  // ═══════════════════════════════════════
  // ④ SOUTH PERIMETER ROAD
  //   Road along south edge of campus
  //   lat ~26.9572–26.9575, serves D Block, E Block, Ground
  //   Connects to lower road via short N-S stubs
  // ═══════════════════════════════════════

  // South road runs east along bottom of campus
  SP_JN:  { lat: 26.957635, lng: 80.998080 },  // mosque/west road junction
  SP1:    { lat: 26.957360, lng: 80.998070 },  // west vertical road beside lawn
  SP2:    { lat: 26.957120, lng: 80.998070 },  // south-west bend
  SP3:    { lat: 26.957080, lng: 80.998300 },  // bottom road begins
  SP4:    { lat: 26.957030, lng: 80.998620 },
  SP5:    { lat: 26.956980, lng: 80.998950 },
  SP6:    { lat: 26.956950, lng: 80.999250 },  // bottom road below D/E blocks
  SP7:    { lat: 26.956950, lng: 80.999430 },  // D Block vertical access
  SP8:    { lat: 26.957080, lng: 80.999430 },
  SP9:    { lat: 26.957180, lng: 81.000700 },  // east/south extension

  // D Block, E Block, Ground entries
  d_block: { lat: 26.957193, lng: 80.999438 },
  e_block: { lat: 26.957178, lng: 81.000316 },
  ground:  { lat: 26.956979, lng: 81.001433 },

  // ═══════════════════════════════════════
  // ⑤ N-S CONNECTOR ROADS
  //   Short roads linking Upper-H ↔ Lower-H ↔ South
  //   Visible in screenshot as short white verticals
  // ═══════════════════════════════════════

  // Connector West — lng ~80.9993 (B Block column)
  // Links PK3/UH area down to lower road, then south road
  CW_N:   { lat: 26.958400, lng: 80.999300 },  // upper road level
  CW_M:   { lat: 26.958100, lng: 80.999300 },  // between rows
  CW_S:   { lat: 26.957800, lng: 80.999300 },  // lower road level
  CW_SS:  { lat: 26.957550, lng: 80.999300 },  // approaching south road

  // Connector Centre — lng ~81.0003 (Library column)
  CC_N:   { lat: 26.958300, lng: 81.000050 },  // upper → diagonal area
  CC_M:   { lat: 26.958100, lng: 81.000070 },
  CC_S:   { lat: 26.957900, lng: 81.000100 },
  CC_SS:  { lat: 26.957700, lng: 81.000150 },  // lower road junction

  // Connector East — lng ~81.0011 (OPD/Medical column)
  CE_N:   { lat: 26.958350, lng: 81.001100 },
  CE_M:   { lat: 26.958150, lng: 81.001100 },
  CE_S:   { lat: 26.957950, lng: 81.001100 },
  CE_SS:  { lat: 26.957750, lng: 81.001100 },  // lower road east arm

};


// ────────────────────────────────────────────────────────────
// 3. EDGES — connecting nodes along actual road paths
// ────────────────────────────────────────────────────────────
const EDGE_DEFINITIONS = [

  // ═══════════════════════════════════
  // ① DIAGONAL SPINE
  // ═══════════════════════════════════
  ["gate2","D01"], ["D01","D02"], ["D02","D03"], ["D03","D04"],
  ["D04","D05"],   ["D05","D06"], ["D06","D07"], ["D07","D08"],
  ["D08","D09"],   ["D09","D10"], ["D10","D11"], ["D11","D12"],
  ["D12","D13"],   ["D13","D14"], ["D14","D15"], ["D15","D16"],
  ["D16","D17"],

  // ═══════════════════════════════════
  // Gate 1 SPUR → connects to diagonal
  // ═══════════════════════════════════
  ["gate1","G1A"], ["G1A","G1B"], ["G1B","G1C"], ["G1C","G1D"],
  // G1D joins diagonal at D04
  ["G1D","D04"],
  // G1B also feeds into west column connector
  ["G1B","CW_N"],

  // Gate 1 south spur → mosque / a_block
  ["G1A","G1S1"], ["G1S1","G1S2"], ["G1S2","G1S3"], ["G1S3","G1S4"],
  ["G1S2","a_block"],
  ["G1S3","a_block"],
  ["G1S4","mosque"],
  // Lawn from G1S4 going east
  ["G1S4","LW1"], ["LW1","lawn"],
  // Mosque/lawn spur stays on the west-side internal road.

  // ═══════════════════════════════════
  // ② UPPER HORIZONTAL ROAD
  // ═══════════════════════════════════
  // Junction on diagonal
  ["D05","UH_JN"], ["D06","UH_JN"],

  // West arm of upper road (toward gate1)
  ["UH_JN","UH1"], ["UH1","UH2"], ["UH2","UH3"],
  ["UH3","G1C"],   // connects to gate1 spur

  // East arm of upper road
  ["UH_JN","D07"],  // the diagonal continues from junction
  ["UH_JN","UH4"], ["UH4","UH5"], ["UH5","UH6"],
  ["UH6","UH7"],   ["UH7","UH8"],

  // Parking → comes from Gate2, drops into D03 area, connects to upper road
  ["gate2","PK1"], ["PK1","PK2"], ["PK2","PK3"],
  ["PK3","D04"], ["PK3","UH_JN"],
  ["parking","PK1"],

  // B Block stub — south face of B Block touches road near CW_N
  ["BB1","b_block"], ["BB1","CW_N"], ["BB1","UH2"],

  // Gym on upper road
  ["GM1","gym"], ["GM1","UH4"],
  // (GM1 is at same lat as UH4, just interpolated)
  ["UH4","GM1"],

  // Medical Block stub
  ["MB1","medical_block"], ["MB1","UH6"],

  // Hospital east end
  ["UH8","HP1"], ["HP1","HP2"], ["HP2","hospital"],

  // ═══════════════════════════════════
  // ③ LOWER HORIZONTAL ROAD
  // ═══════════════════════════════════
  // Junction on diagonal
  ["D14","LH_JN"], ["D13","LH_JN"],

  // West arm
  ["LH_JN","LH_W1"],["LH_W1","LH_W2"],["LH_W2","LH_W3"],
  ["LH_W3","LH_W4"],["LH_W4","LH_W5"],["LH_W5","LH_W6"],

  // East arm
  ["LH_JN","LH_E1"],["LH_E1","LH_E2"],["LH_E2","LH_E3"],

  // Canteen from lower road west arm
  ["LH_W4","canteen"], ["LH_W3","canteen"],

  // Auditorium stub (faces lower road)
  ["AU1","auditorium"],["LH_W2","AU1"],["LH_W1","AU1"],

  // Library stub
  ["CL1","central_library"],["LH_JN","CL1"],["LH_W1","CL1"],

  // F Block stub (slightly south of lower road)
  ["FB1","f_block"],["LH_E1","FB1"],

  // OPD stub
  ["OPD1","opd"],["LH_E2","OPD1"],

  // ═══════════════════════════════════
  // ④ BUILDING ACCESS FROM WHITE INTERNAL ROADS
  // ═══════════════════════════════════
  // Keep these access links short and tied to visible internal roads.
  ["G1S4","SP_JN", [
    [26.957650, 80.998080],
    [26.957635, 80.998080],
  ]],
  ["SP_JN","SP1", [
    [26.957635, 80.998080],
    [26.957500, 80.998075],
    [26.957360, 80.998070],
  ]],
  ["SP1","SP2", [
    [26.957360, 80.998070],
    [26.957240, 80.998070],
    [26.957120, 80.998070],
  ]],
  ["SP2","SP3", [
    [26.957120, 80.998070],
    [26.957090, 80.998160],
    [26.957080, 80.998300],
  ]],
  ["SP3","SP4", [
    [26.957080, 80.998300],
    [26.957055, 80.998455],
    [26.957030, 80.998620],
  ]],
  ["SP4","SP5", [
    [26.957030, 80.998620],
    [26.957000, 80.998790],
    [26.956980, 80.998950],
  ]],
  ["SP5","SP6", [
    [26.956980, 80.998950],
    [26.956960, 80.999100],
    [26.956950, 80.999250],
  ]],
  ["SP6","SP7", [
    [26.956950, 80.999250],
    [26.956950, 80.999430],
  ]],
  ["SP7","SP8", [
    [26.956950, 80.999430],
    [26.957020, 80.999430],
    [26.957080, 80.999430],
  ]],
  ["SP8","d_block"],
  ["SP8","LH_W3"],["SP8","LH_W4"],
  ["SP9","e_block"],["LH_E1","e_block"],["LH_E2","e_block"],
  ["CE_SS","ground"],

  // ═══════════════════════════════════
  // ⑤ N-S CONNECTORS
  // ═══════════════════════════════════

  // --- West Connector (lng ~80.9993) ---
  // G1B → CW_N → CW_M → CW_S → LH_W4 area → SP_JN
  ["CW_N","CW_M"],["CW_M","CW_S"],["CW_S","CW_SS"],
  ["CW_SS","LH_W4"],
  // CW_N ties to upper road
  ["CW_N","UH2"],["CW_N","UH3"],
  // CW_M ties to B Block
  ["CW_M","b_block"],
  // CW_S ties to lower road
  ["CW_S","LH_W3"],

  // --- Centre Connector (lng ~81.0003-81.0010) ---
  // Links upper road → diagonal mid → lower road
  ["D09","CC_N"],["D10","CC_N"],
  ["CC_N","CC_M"],["CC_M","CC_S"],["CC_S","CC_SS"],
  ["CC_SS","LH_JN"],["CC_SS","LH_W1"],
  // CC_N area to upper road (D10 is close to UH area)
  ["CC_M","D11"],

  // --- East Connector (lng ~81.0011) ---
  // Links upper road UH5/UH6 → lower road east arm → south
  ["UH5","CE_N"],["UH6","CE_N"],
  ["CE_N","MB1"],           // medical block off this connector
  ["CE_N","CE_M"],["CE_M","CE_S"],["CE_S","CE_SS"],
  ["CE_SS","LH_E3"],["CE_SS","LH_E2"],
  // South end of east connector ties to south road
  ["CE_SS","LH_E3"],

];

const ROUTE_PATH_OVERRIDES = {
  "gate1|gate2": [
    [26.95841515939675,80.99819004535676],
    [26.95852035229913,80.9983402490616],
    [26.95873073780919,80.9985387325287],
    [26.958969811775486,80.99881231784822],
    [26.95906065974966,80.9989546632768],
    [26.959132381782773,80.99894106388093],
  ],
  "gate1|mosque": [
    [26.958300403391224,80.99811762571336],
    [26.95827888662716,80.99816590547562],
    [26.95825976061122,80.99821686744691],
    [26.958233462334015,80.99827051162721],
    [26.9582167270635,80.99831342697145],
    [26.958154567465513,80.99830001592638],
    [26.958101970855818,80.99826514720918],
    [26.95804459270815,80.99823564291002],
    [26.957953743914565,80.99819272756578],
    [26.957867676568856,80.99816322326662],
    [26.95779834449254,80.99812835454942],
    [26.957755310768544,80.9980881214142],
  ],
  "gate1|lawn": [
    [26.958309966396154,80.99809348583223],
    [26.95829562188844,80.99812835454942],
    [26.95826932361961,80.99817663431169],
    [26.95825019760204,80.99821954965593],
    [26.958211945557178,80.9983053803444],
    [26.958188038022527,80.99836975336076],
    [26.958159348974277,80.99843949079515],
    [26.958123487653673,80.99850118160249],
    [26.958070891029447,80.99861919879915],
    [26.958015903623362,80.99870771169664],
    [26.957908319490304,80.9986299276352],
    [26.957781609157397,80.9985736012459],
  ],
  "gate1|a_block": [
    [26.958293231136985,80.99811226129533],
    [26.958235853086745,80.99820613861085],
    [26.95819999179049,80.99831342697145],
    [26.957999168320505,80.99819809198381],
    [26.957858113526395,80.99809348583223],
  ],
  "gate1|b_block": [
    [26.958266932867595,80.99820077419282],
    [26.95818564726878,80.998415350914],
    [26.958051764978215,80.99871039390565],
    [26.957946571638267,80.99890887737276],
    [26.958023075895234,80.99900543689729],
  ],
  "gate1|canteen": [
    [26.958262151363385,80.99825441837312],
    [26.95829562188844,80.99813640117647],
    [26.958147395201987,80.99846899509431],
    [26.957999168320505,80.9987476692201],
    [26.95777443687013,80.99921464920045],
    [26.957669243271233,80.9994399547577],
    [26.957487545005414,80.99933266639711],
  ],
  "gate1|d_block": [
    [26.958262151363385,80.99819004535676],
    [26.958166521237015,80.99839389324188],
    [26.958042201951375,80.99869430065156],
    [26.95789875645128,80.99897325038911],
    [26.957731403136997,80.9993487596512],
    [26.957597520306575,80.99962770938875],
    [26.957382351138637,80.99947214126588],
  ],
  "gate1|auditorium": [
    [26.958257369859002,80.99825978279115],
    [26.9582605888229,80.99816858768465],
    [26.958161739728556,80.9984314441681],
    [26.95801351286595,80.99874794483185],
    [26.957841378200104,80.99911272525787],
    [26.957697932444315,80.99941849708559],
    [26.957559268040097,80.99967598915102],
    [26.957521015760612,80.9998905658722],
  ],
  "gate1|central_library": [
    [26.958257369859002,80.99822759628296],
    [26.95809479858896,80.99854409694673],
    [26.957865285808317,80.99903225898744],
    [26.95752579729627,80.9996920824051],
    [26.957597520306575,80.99991202354433],
  ],
  "gate1|e_block": [
    [26.958214336310338,80.99828124046327],
    [26.958032638923697,80.9986996650696],
    [26.957841378200104,80.9990966320038],
    [26.957602301838975,80.9995472431183],
    [26.95742060346519,80.9995493888856],
    [26.95735366188518,81.00019097328187],
  ],
  "gate1|f_block": [
    [26.958223899322572,80.99823832511902],
    [26.958042201951375,80.99867820739748],
    [26.957755310768544,80.99922537803651],
    [26.957439729623598,80.99987983703615],
    [26.95734409879908,81.00020170211793],
    [26.95750667115247,81.00046992301942],
  ],
  "gate1|opd": [
    [26.95818564726878,80.99838852882387],
    [26.957956134673246,80.99890351295473],
    [26.957736184663723,80.99933266639711],
    [26.95744929270158,80.9993348121644],
    [26.957133710699384,81.00063085556032],
    [26.957038079615106,81.00098490715028],
    [26.957497108079348,81.00127458572389],
    [26.957573612641546,81.00110292434694],
  ],
  "gate1|ground": [
    [26.958166521237015,80.99832415580751],
    [26.958061328004238,80.99868893623353],
    [26.95777443687013,80.99916100502016],
    [26.957468418855125,80.99978327751161],
    [26.957143273803347,81.00064158439638],
    [26.956875506585504,81.00125312805177],
  ],
  "gate1|parking": [
    [26.95852035229913,80.99835634231569],
    [26.958654234032792,80.99856019020082],
    [26.958883745206062,80.99873185157777],
    [26.95901762650786,80.99892497062683],
    [26.95874182249858,80.99926829338074],
    [26.958778552643036,80.99952578544618],
    [26.9589793747236,80.99972963333131],
  ],
  "gate1|gym": [
    [26.958529915285382,80.99842071533205],
    [26.958778552643036,80.99871039390565],
    [26.958988937670874,80.99893569946289],
    [26.958902871116077,80.99924683570863],
    [26.958759426711925,80.99948287010194],
    [26.9585860423926,80.99978327751161],
    [26.958453411372602,81.00004076957704],
    [26.958797678570885,81.000394821167],
  ],
  "gate1|medical_block": [
    [26.95817084253317,80.99842071533205],
    [26.957870067329342,80.99906444549562],
    [26.95759273877397,80.9995015846254],
    [26.957363224970486,81.00011587142946],
    [26.9570858951674,81.0007166862488],
    [26.95732497262444,81.00124239921571],
    [26.95774574771654,81.0014569759369],
    [26.957946571638267,81.0015106201172],
    [26.958166521237015,81.00165009498598],
    [26.958176084253317,81.0014569759369],
  ],
  "gate1|hospital": [
    [26.958271714371573,80.99823832511902],
    [26.95777443687013,80.99911808967592],
    [26.957372788054958,81.00001931190492],
    [26.9570858951674,81.00087761878969],
    [26.957152836906516,81.00109219551088],
    [26.957602301838975,81.00137114524841],
    [26.958099580100242,81.0016179084778],
    [26.958262151363385,81.00177884101869],
    [26.95813783218327,81.00193977355958],
  ],
};

const TRACED_ROAD_POINTS = [
  [26.958309966396154,80.99814713001253],
  [26.95829562188844,80.99820613861085],
  [26.958252588354412,80.99824368953706],
  [26.95823824383942,80.99831879138948],
  [26.95819042877622,80.99837243556978],
  [26.958142613692743,80.99849045276643],
  [26.958066109516945,80.99865674972536],
  [26.957999168320505,80.99881231784822],
  [26.9578318151554,80.99867284297945],
  [26.95789875645128,80.9987372159958],
  [26.95808523556576,80.9988981485367],
  [26.958128269163733,80.99901080131532],
  [26.958142613692743,80.99827051162721],
  [26.958061328004238,80.99815785884859],
  [26.957965697707387,80.99807739257814],
  [26.958080454053867,80.99845826625825],
  [26.957956134673246,80.99835097789766],
  [26.95779834449254,80.99827051162721],
  [26.957688369387427,80.99818468093873],
  [26.957893974931473,80.99898397922517],
  [26.95784615972215,80.9990966320038],
  [26.957769655345032,80.9992414712906],
  [26.95772184008296,80.99935948848726],
  [26.957564049574124,80.99930584430696],
  [26.957521015760612,80.99928975105286],
  [26.95765968021193,80.99948287010194],
  [26.957607083371173,80.99959552288057],
  [26.957549704971427,80.99971890449525],
  [26.957578394174963,80.99987983703615],
  [26.957468418855125,80.99983155727388],
  [26.957430166544803,80.99997103214265],
  [26.957564049574124,81.0000514984131],
  [26.957544923436814,80.99951505661012],
  [26.957473200392997,80.99947214126588],
  [26.95740625884425,80.99943459033967],
  [26.95732019108026,80.99939167499544],
  [26.957372788054958,81.00009441375734],
  [26.957339317255713,81.00021779537202],
  [26.95727715717362,81.0003411769867],
  [26.957162400008848,81.00018560886384],
  [26.957348880342245,81.0004109144211],
  [26.9574253850051,81.00046992301942],
  [26.95721021550837,81.00049674510956],
  [26.957124147594612,81.00067913532259],
  [26.957061987393796,81.00082397460939],
  [26.95701417183135,81.00097954273225],
  [26.95696157468923,81.00116193294527],
  [26.956932885328623,81.00133359432222],
  [26.957081113613064,81.00104928016663],
  [26.957200652410084,81.001113653183],
  [26.95730106490155,81.00115656852724],
  [26.957430166544803,81.0012209415436],
  [26.95754014190197,81.00128531455995],
  [26.957602301838975,81.00132286548616],
  [26.957674024800582,81.00136041641235],
  [26.95776009229425,81.00142478942873],
  [26.95785572276565,81.0014569759369],
  [26.9579131010095,81.00138723850252],
  [26.95795135315586,81.00131750106813],
  [26.958023075895234,81.00118875503541],
  [26.958042201951375,81.00109755992891],
  [26.958061328004238,81.00102245807649],
  [26.957956134673246,81.00095808506013],
  [26.958008731351008,81.00099563598634],
  [26.958113924632915,81.00105464458467],
  [26.958171302745267,81.00108683109285],
  [26.95810914312222,81.00097417831422],
  [26.958152176711057,81.00087225437164],
  [26.958204773297318,81.00074887275697],
  [26.958247806849617,81.0006469488144],
  [26.9583147478983,81.00053966045381],
  [26.95835299990825,81.00044310092927],
  [26.958419940894444,81.00027680397035],
  [26.95847253735567,81.00014805793764],
  [26.958506007818208,81.00007832050325],
  [26.95854904125545,81.00002467632295],
  [26.95860641914618,81.00003004074098],
  [26.9586446710571,81.00006222724916],
  [26.958601637656397,81.00016415119171],
  [26.958544259763226,81.00026071071626],
  [26.95851078931206,81.00038945674898],
  [26.95845819286867,81.00048065185548],
  [26.95841037789885,81.00056111812593],
  [26.958372125908365,81.00065231323244],
  [26.958338655406035,81.00072205066682],
  [26.958300403391224,81.00081324577333],
  [26.958228680828384,81.00092589855196],
  [26.9586637970077,81.00001394748689],
  [26.958721174839983,80.99987983703615],
  [26.958764208195014,80.99979937076569],
  [26.958831148936838,80.99964916706087],
  [26.958912434069866,80.99968671798707],
  [26.958888526683882,80.99950969219209],
  [26.958936341450755,80.9994024038315],
  [26.958993719144217,80.99931120872499],
  [26.959027189451923,80.99920928478242],
  [26.959070222690038,80.99912881851198],
  [26.959103692974995,80.9990429878235],
];


// ────────────────────────────────────────────────────────────
// 4. DIJKSTRA
// ────────────────────────────────────────────────────────────

function haversine(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function latLngForNode(id) {
  return [NODES[id].lat, NODES[id].lng];
}

function pointToNode(point) {
  return { lat: point[0], lng: point[1] };
}

function getPathDistance(path) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += haversine(pointToNode(path[i - 1]), pointToNode(path[i]));
  }
  return total;
}

function buildRoadEdges() {
  const roadEdges = {};
  Object.keys(NODES).forEach(id => { roadEdges[id] = {}; });

  EDGE_DEFINITIONS.forEach(([a, b, tracedPath]) => {
    if (!NODES[a]) { console.warn("⚠ Missing node:", a); return; }
    if (!NODES[b]) { console.warn("⚠ Missing node:", b); return; }

    const forwardPath = tracedPath || [latLngForNode(a), latLngForNode(b)];
    const reversePath = [...forwardPath].reverse();
    const weight = getPathDistance(forwardPath);

    roadEdges[a][b] = { weight, path: forwardPath };
    roadEdges[b][a] = { weight, path: reversePath };
  });

  return roadEdges;
}

const ROAD_EDGES = buildRoadEdges();

function buildGraph() {
  const g = {};
  Object.keys(ROAD_EDGES).forEach(id => {
    g[id] = Object.entries(ROAD_EDGES[id]).map(([neighborId, edge]) => ({
      id: neighborId,
      dist: edge.weight,
    }));
  });
  return g;
}

function dijkstra(graph, start, end) {
  const dist = {}, prev = {};
  Object.keys(graph).forEach(id => { dist[id] = Infinity; prev[id] = null; });
  dist[start] = 0;
  const visited = new Set();
  const pq = [{ id: start, dist: 0 }];

  while (pq.length) {
    pq.sort((a, b) => a.dist - b.dist);
    const { id: cur } = pq.shift();
    if (visited.has(cur)) continue;
    visited.add(cur);
    if (cur === end) break;
    for (const nb of (graph[cur] || [])) {
      if (visited.has(nb.id)) continue;
      const nd = dist[cur] + nb.dist;
      if (nd < dist[nb.id]) {
        dist[nb.id] = nd;
        prev[nb.id] = cur;
        pq.push({ id: nb.id, dist: nd });
      }
    }
  }

  if (dist[end] === Infinity) return null;
  const path = [];
  let c = end;
  while (c) { path.unshift(c); c = prev[c]; }
  return path;
}

function addGraphEdge(graph, from, to, dist) {
  if (!graph[from]) graph[from] = [];
  if (!graph[to]) graph[to] = [];
  graph[from].push({ id: to, dist });
  graph[to].push({ id: from, dist });
}

function traceNodeId(index) {
  return `trace_${index}`;
}

function buildTracedRoadGraph() {
  const graph = {};
  const maxConsecutiveGap = 70;
  const intersectionSnapDistance = 42;

  TRACED_ROAD_POINTS.forEach((point, index) => {
    graph[traceNodeId(index)] = [];
  });

  for (let i = 1; i < TRACED_ROAD_POINTS.length; i += 1) {
    const dist = haversine(pointToNode(TRACED_ROAD_POINTS[i - 1]), pointToNode(TRACED_ROAD_POINTS[i]));
    if (dist <= maxConsecutiveGap) {
      addGraphEdge(graph, traceNodeId(i - 1), traceNodeId(i), dist);
    }
  }

  for (let i = 0; i < TRACED_ROAD_POINTS.length; i += 1) {
    for (let j = i + 2; j < TRACED_ROAD_POINTS.length; j += 1) {
      const dist = haversine(pointToNode(TRACED_ROAD_POINTS[i]), pointToNode(TRACED_ROAD_POINTS[j]));
      if (dist <= intersectionSnapDistance) {
        addGraphEdge(graph, traceNodeId(i), traceNodeId(j), dist);
      }
    }
  }

  return graph;
}

const TRACED_ROAD_GRAPH = buildTracedRoadGraph();

function nearestTracedRoadNode(lat, lng) {
  let bestId = null;
  let bestDistance = Infinity;

  TRACED_ROAD_POINTS.forEach((point, index) => {
    const dist = haversine({ lat, lng }, pointToNode(point));
    if (dist < bestDistance) {
      bestDistance = dist;
      bestId = traceNodeId(index);
    }
  });

  return { id: bestId, dist: bestDistance };
}

function tracedNodeToLatLng(id) {
  const index = Number(id.replace('trace_', ''));
  return TRACED_ROAD_POINTS[index];
}

function buildLocationAwareTraceGraph(startNodeId, endNodeId) {
  const graph = {};

  Object.entries(TRACED_ROAD_GRAPH).forEach(([id, edges]) => {
    graph[id] = edges.map(edge => ({ ...edge }));
  });

  [startNodeId, endNodeId].forEach(nodeId => {
    const nearest = nearestTracedRoadNode(NODES[nodeId].lat, NODES[nodeId].lng);
    graph[nodeId] = [];
    addGraphEdge(graph, nodeId, nearest.id, nearest.dist);
  });

  return graph;
}

function buildTracedRoutePath(nodePath) {
  if (!nodePath) return null;

  return nodePath.map(nodeId => (
    nodeId.startsWith('trace_') ? tracedNodeToLatLng(nodeId) : latLngForNode(nodeId)
  ));
}

function interpolatePoint(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
}

function getPointAtDistance(polyline, targetDistance) {
  if (targetDistance <= 0) return polyline[0];

  let walked = 0;
  for (let i = 1; i < polyline.length; i += 1) {
    const segmentDistance = haversine(pointToNode(polyline[i - 1]), pointToNode(polyline[i]));
    if (walked + segmentDistance >= targetDistance) {
      const t = segmentDistance === 0 ? 0 : (targetDistance - walked) / segmentDistance;
      return interpolatePoint(polyline[i - 1], polyline[i], t);
    }
    walked += segmentDistance;
  }

  return polyline[polyline.length - 1];
}

function slicePolylineByDistance(polyline, startDistance, endDistance) {
  const totalDistance = getPathDistance(polyline);
  const start = Math.max(0, Math.min(startDistance, totalDistance));
  const end = Math.max(start, Math.min(endDistance, totalDistance));
  const sliced = [getPointAtDistance(polyline, start)];
  let walked = 0;

  for (let i = 1; i < polyline.length; i += 1) {
    const segmentDistance = haversine(pointToNode(polyline[i - 1]), pointToNode(polyline[i]));
    const nextWalked = walked + segmentDistance;

    if (nextWalked > start && nextWalked < end) {
      sliced.push(polyline[i]);
    }

    walked = nextWalked;
  }

  sliced.push(getPointAtDistance(polyline, end));
  return sliced;
}

function setEdgeGeometry(a, b, path) {
  if (!ROAD_EDGES[a] || !ROAD_EDGES[a][b] || path.length < 2) return;

  const weight = getPathDistance(path);
  ROAD_EDGES[a][b] = { weight, path };
  ROAD_EDGES[b][a] = { weight, path: [...path].reverse() };
}

function getStoredEdgeDistance(a, b) {
  return ROAD_EDGES[a] && ROAD_EDGES[a][b]
    ? ROAD_EDGES[a][b].weight
    : haversine(NODES[a], NODES[b]);
}

function getStoredRouteDistance(path) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += getStoredEdgeDistance(path[i - 1], path[i]);
  }
  return total;
}

function applyRouteOverrideGeometries() {
  const baseGraph = buildGraph();

  Object.entries(ROUTE_PATH_OVERRIDES).forEach(([key, tracedPath]) => {
    const [startId, endId] = key.split('|');
    const nodePath = dijkstra(baseGraph, startId, endId);

    if (!nodePath || nodePath.length < 2 || tracedPath.length < 2) return;

    const routeDistance = getPathDistance(tracedPath);
    const graphDistance = getStoredRouteDistance(nodePath);
    if (routeDistance === 0 || graphDistance === 0) return;

    let graphWalked = 0;
    for (let i = 1; i < nodePath.length; i += 1) {
      const a = nodePath[i - 1];
      const b = nodePath[i];
      const edgeDistance = getStoredEdgeDistance(a, b);
      const startDistance = (graphWalked / graphDistance) * routeDistance;
      const endDistance = ((graphWalked + edgeDistance) / graphDistance) * routeDistance;
      const edgePath = slicePolylineByDistance(tracedPath, startDistance, endDistance);

      setEdgeGeometry(a, b, edgePath);
      graphWalked += edgeDistance;
    }
  });
}

applyRouteOverrideGeometries();

function nearestNode(lat, lng) {
  let best = null, bestD = Infinity;
  Object.entries(NODES).forEach(([id, n]) => {
    if (!ROAD_EDGES[id] || Object.keys(ROAD_EDGES[id]).length === 0) return;
    const d = haversine({ lat, lng }, n);
    if (d < bestD) { bestD = d; best = id; }
  });
  return best;
}

function nearestLocation(lat, lng) {
  let best = null, bestD = Infinity;
  LOCATIONS.forEach(loc => {
    const d = haversine({ lat, lng }, loc);
    if (d < bestD) { bestD = d; best = loc.id; }
  });
  return best;
}


// ────────────────────────────────────────────────────────────
// 5. MAP SETUP
// ────────────────────────────────────────────────────────────

// Campus hard boundary — all nodes must be inside this box
// This prevents Leaflet from allowing pan outside campus
const CAMPUS_BOUNDS = L.latLngBounds(
  [26.9563, 80.9978],   // SW — just inside Gate1/Mosque corner
  [26.9598, 81.0025]    // NE — hospital east end
);

const map = L.map('map', {
  center:             [26.9580, 81.0000],
  zoom:               17,
  zoomControl:        false,
  maxBounds:          CAMPUS_BOUNDS,
  maxBoundsViscosity: 1.0,   // hard stop — cannot pan outside
  minZoom:            16,
  maxZoom:            19,
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);

// ── Marker factory ───────────────────────
function makeDivIcon(cls) {
  return L.divIcon({ className: cls, iconSize: [12, 12], iconAnchor: [6, 6] });
}

// ── Building markers ─────────────────────
LOCATIONS.forEach(loc => {
  L.marker([loc.lat, loc.lng], {
    icon: makeDivIcon('campus-marker'), title: loc.name,
  }).addTo(map).bindPopup(`
    <div class="popup-content">
      <div class="popup-title">${loc.name}</div>
      <div class="popup-coords">${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}</div>
    </div>
  `, {
    closeButton: true,
    autoClose: true,
    closeOnEscapeKey: true,
    className: 'custom-popup'
  });
});

// ── DEBUG MODE: uncomment to see all road nodes as dots ──
// Useful for verifying that nodes fall ON the white road lines.
// Each yellow dot = a road node. If a dot is off-road, move it.
/*
Object.entries(NODES).forEach(([id, n]) => {
  L.circleMarker([n.lat, n.lng], {
    radius: 4,
    color: '#ffff00',
    weight: 1,
    fillColor: '#ff8800',
    fillOpacity: 0.9,
  }).addTo(map).bindPopup(`
    <div class="popup-content">
      <div class="popup-title">Node ${id}</div>
      <div class="popup-coords">${n.lat.toFixed(6)}, ${n.lng.toFixed(6)}</div>
    </div>
  `, {
    closeButton: true,
    autoClose: true,
    closeOnEscapeKey: true,
    className: 'custom-popup'
  });
});
*/

// ── Route layers ─────────────────────────
let startMarker = null, endMarker = null, userMarker = null;

// ── Navigation state ─────────────────────
let isNavigating = false;
let navigationWatchId = null;
let currentDestination = null;
let currentRoutePath = [];
let currentRouteLatLngs = [];
let currentRouteSteps = [];
let lastUserPosition = null;

function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function pathToLatLngs(path) {
  return path.map(id => [NODES[id].lat, NODES[id].lng]);
}

function getEdge(a, b) {
  return ROAD_EDGES[a] && ROAD_EDGES[a][b] ? ROAD_EDGES[a][b] : null;
}

function getEdgeDistance(a, b) {
  const edge = getEdge(a, b);
  return edge ? edge.weight : haversine(NODES[a], NODES[b]);
}

function buildFullRoadPath(path) {
  const fullPath = [];

  for (let i = 1; i < path.length; i += 1) {
    const edge = getEdge(path[i - 1], path[i]);
    const segment = edge ? edge.path : [latLngForNode(path[i - 1]), latLngForNode(path[i])];
    const points = i === 1 ? segment : segment.slice(1);
    fullPath.push(...points);
  }

  return fullPath;
}

function getRoutePathOverride(startId, endId) {
  const forwardKey = `${startId}|${endId}`;
  const reverseKey = `${endId}|${startId}`;

  if (ROUTE_PATH_OVERRIDES[forwardKey]) {
    return ROUTE_PATH_OVERRIDES[forwardKey];
  }

  if (ROUTE_PATH_OVERRIDES[reverseKey]) {
    return [...ROUTE_PATH_OVERRIDES[reverseKey]].reverse();
  }

  return null;
}

function samePoint(a, b, toleranceMeters = 1) {
  return haversine(pointToNode(a), pointToNode(b)) <= toleranceMeters;
}

function normalizeRenderedRoute(startNodeId, endNodeId, latlngs) {
  if (!latlngs || latlngs.length < 2) return latlngs;

  const normalized = latlngs.filter((point, index) => (
    index === 0 || !samePoint(point, latlngs[index - 1])
  ));
  const startPoint = latLngForNode(startNodeId);
  const endPoint = latLngForNode(endNodeId);

  if (!samePoint(normalized[0], startPoint, 2)) {
    normalized.unshift(startPoint);
  }

  if (!samePoint(normalized[normalized.length - 1], endPoint, 2)) {
    normalized.push(endPoint);
  }

  return normalized;
}

function getRouteDistance(path) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += getEdgeDistance(path[i - 1], path[i]);
  }
  return total;
}

function normalizeTurnDelta(degrees) {
  return ((degrees + 540) % 360) - 180;
}

function getCompassDirection(bearing) {
  const directions = [
    'north', 'north-east', 'east', 'south-east',
    'south', 'south-west', 'west', 'north-west'
  ];
  return directions[Math.round(bearing / 45) % 8];
}

function getTurnInstruction(delta) {
  const absDelta = Math.abs(delta);
  const side = delta > 0 ? 'right' : 'left';

  if (absDelta < 30) return null;
  if (absDelta < 60) return `Slight ${side}`;
  if (absDelta < 135) return `Turn ${side}`;
  return `Make a sharp ${side}`;
}

function buildRouteSteps(path, startName, endName) {
  if (!path || path.length < 2) return [];

  const steps = [];
  let distanceFromStart = 0;
  let legDistance = getEdgeDistance(path[0], path[1]);
  let previousBearing = calculateBearing(NODES[path[0]], NODES[path[1]]);

  steps.push({
    type: 'depart',
    nodeIndex: 0,
    distanceFromStart: 0,
    text: `Head ${getCompassDirection(previousBearing)} from ${startName}`
  });

  for (let i = 1; i < path.length - 1; i += 1) {
    const current = NODES[path[i]];
    const next = NODES[path[i + 1]];
    const nextBearing = calculateBearing(current, next);
    const turnText = getTurnInstruction(normalizeTurnDelta(nextBearing - previousBearing));

    distanceFromStart += legDistance;
    if (turnText) {
      steps.push({
        type: 'turn',
        action: turnText,
        nodeIndex: i,
        distanceFromStart,
        text: `${turnText} in ${formatDistance(distanceFromStart)}`
      });
    }

    legDistance = getEdgeDistance(path[i], path[i + 1]);
    previousBearing = nextBearing;
  }

  steps.push({
    type: 'arrive',
    nodeIndex: path.length - 1,
    distanceFromStart: getRouteDistance(path),
    text: `Arrive at ${endName}`
  });

  return steps;
}

function drawRoute(path, overrideLatLngs = null) {
  clearRoute();
  const latlngs = overrideLatLngs || buildFullRoadPath(path);
  currentRoutePath = path;
  currentRouteLatLngs = latlngs;

  // Drop shadow
  L.polyline(latlngs, {
    color: '#000', weight: 12, opacity: 0.2,
    lineJoin: 'round', lineCap: 'round', smoothFactor: 0.6,
  }).addTo(map).bringToBack();

  // Google Maps-style outer stroke
  L.polyline(latlngs, {
    color: '#0b57d0', weight: 8, opacity: 0.95,
    lineJoin: 'round', lineCap: 'round', smoothFactor: 0.6,
  }).addTo(map);

  // Main route
  L.polyline(latlngs, {
    color: '#5bbcff', weight: 4, opacity: 1,
    lineJoin: 'round', lineCap: 'round', smoothFactor: 0.6,
  }).addTo(map);
}

function placeEndpointMarkers(sId, eId) {
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker)   map.removeLayer(endMarker);
  startMarker = L.marker([NODES[sId].lat, NODES[sId].lng], {
    icon: makeDivIcon('start-marker'), zIndexOffset: 1000,
  }).addTo(map).bindPopup(`
    <div class="popup-content">
      <div class="popup-title">Starting Point</div>
      <div class="popup-coords">${NODES[sId].lat.toFixed(6)}, ${NODES[sId].lng.toFixed(6)}</div>
    </div>
  `, {
    closeButton: true,
    autoClose: true,
    closeOnEscapeKey: true,
    className: 'custom-popup'
  });
  endMarker = L.marker([NODES[eId].lat, NODES[eId].lng], {
    icon: makeDivIcon('end-marker'), zIndexOffset: 1000,
  }).addTo(map).bindPopup(`
    <div class="popup-content">
      <div class="popup-title">Destination</div>
      <div class="popup-coords">${NODES[eId].lat.toFixed(6)}, ${NODES[eId].lng.toFixed(6)}</div>
    </div>
  `, {
    closeButton: true,
    autoClose: true,
    closeOnEscapeKey: true,
    className: 'custom-popup'
  });
}

function clearRoute() {
  map.eachLayer(l => { if (l instanceof L.Polyline) map.removeLayer(l); });
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker)   { map.removeLayer(endMarker);   endMarker   = null; }
  if (userMarker)  { map.removeLayer(userMarker);  userMarker  = null; }
  currentRoutePath = [];
  currentRouteLatLngs = [];
  currentRouteSteps = [];
  stopNavigation();
}

// ────────────────────────────────────────────────────────────
// 7. GPS NAVIGATION FUNCTIONS
// ────────────────────────────────────────────────────────────

function calculateBearing(from, to) {
  const dLon = (to.lng - from.lng) * Math.PI / 180;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
}

function getDirectionArrow(bearing) {
  const directions = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

function getDirectionText(bearing, distance) {
  const directions = [
    'North', 'North-East', 'East', 'South-East',
    'South', 'South-West', 'West', 'North-West'
  ];
  const index = Math.round(bearing / 45) % 8;
  const direction = directions[index];
  const distText = distance < 1000 ? `${Math.round(distance)}m` : `${(distance/1000).toFixed(1)}km`;
  return `Head ${direction} • ${distText} remaining`;
}

function updateNavigationPanel(position) {
  if (!isNavigating || !currentDestination) return;

  const userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
  const destLatLng = L.latLng(currentDestination.lat, currentDestination.lng);

  const distance = haversine(userLatLng, destLatLng);
  const bearing = calculateBearing(userLatLng, destLatLng);
  const nextRouteStep = getNextRouteStep(userLatLng);

  // Update navigation panel
  const navPanel = document.getElementById('nav-panel');
  const navDistance = document.getElementById('nav-distance');
  const directionArrow = document.getElementById('direction-arrow');
  const directionText = document.getElementById('direction-text');

  navDistance.textContent = formatDistance(distance);
  directionArrow.textContent = getDirectionArrow(bearing);
  directionText.textContent = nextRouteStep ? nextRouteStep.text : getDirectionText(bearing, distance);

  // Show panel if hidden
  if (navPanel.classList.contains('hidden')) {
    navPanel.classList.remove('hidden');
  }

  // Check if arrived at destination
  if (distance < 20) { // Within 20 meters
    stopNavigation();
    setStatus('🎯', `You have arrived at ${currentDestination.name}!`, null);
    // Vibrate on mobile devices
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
    return;
  }

  // Update status with navigation info
  const walkMin = Math.ceil(distance / 1.2 / 60);
  setStatus('🧭', nextRouteStep ? nextRouteStep.text : `Navigate to ${currentDestination.name} • ~${walkMin} min`, formatDistance(distance));
}

function getNextRouteStep(userLatLng) {
  if (!currentRoutePath.length || !currentRouteSteps.length) return null;

  let nearestIndex = 0;
  let nearestDistance = Infinity;
  currentRoutePath.forEach((nodeId, index) => {
    const nodeDistance = haversine(userLatLng, NODES[nodeId]);
    if (nodeDistance < nearestDistance) {
      nearestDistance = nodeDistance;
      nearestIndex = index;
    }
  });

  const step = currentRouteSteps.find(nextStep => nextStep.nodeIndex > nearestIndex) || currentRouteSteps[currentRouteSteps.length - 1];

  if (step.type === 'turn' && step.action) {
    let distanceToStep = haversine(userLatLng, NODES[currentRoutePath[nearestIndex]]);
    for (let i = nearestIndex + 1; i <= step.nodeIndex; i += 1) {
      distanceToStep += getEdgeDistance(currentRoutePath[i - 1], currentRoutePath[i]);
    }
    return { ...step, text: `${step.action} in ${formatDistance(distanceToStep)}` };
  }

  return step;
}

function startNavigation(destination) {
  if (!navigator.geolocation) {
    setStatus('❌', 'Geolocation is not supported by this browser.', null);
    return;
  }

  currentDestination = destination;
  isNavigating = true;
  updateGPSButton();

  setStatus('🧭', 'Starting navigation...', null);

  // Vibrate on mobile devices
  if ('vibrate' in navigator) {
    navigator.vibrate(150);
  }

  // Start watching position
  navigationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Check if within campus bounds
      if (!CAMPUS_BOUNDS.contains([lat, lng])) {
        setStatus('⚠', 'You are outside the campus area.', null);
        return;
      }

      lastUserPosition = { lat, lng, coords: position.coords };

      // Update or create user marker
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      } else {
        userMarker = L.marker([lat, lng], {
          icon: makeDivIcon('user-marker'), zIndexOffset: 1000,
        }).addTo(map).bindPopup(`
          <div class="popup-content">
            <div class="popup-title">Your Location</div>
            <div class="popup-coords">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
            <div class="popup-accuracy">±${Math.round(position.coords.accuracy)}m accuracy</div>
          </div>
        `, {
          closeButton: true,
          autoClose: true,
          closeOnEscapeKey: true,
          className: 'custom-popup'
        });
      }

      // Update navigation
      updateNavigationPanel(position);

      // Auto-pan to user location on mobile
      if (window.innerWidth <= 768) {
        map.panTo([lat, lng], { animate: true, duration: 0.5 });
      }
    },
    (error) => {
      let msg = 'Navigation error: ';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          msg += 'Location access denied.';
          break;
        case error.POSITION_UNAVAILABLE:
          msg += 'Location unavailable.';
          break;
        case error.TIMEOUT:
          msg += 'Location request timed out.';
          break;
        default:
          msg += 'Unknown error.';
      }
      setStatus('❌', msg, null);
      stopNavigation();
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000 // Accept positions up to 5 seconds old
    }
  );
}

function stopNavigation() {
  if (navigationWatchId) {
    navigator.geolocation.clearWatch(navigationWatchId);
    navigationWatchId = null;
  }

  isNavigating = false;
  currentDestination = null;
  updateGPSButton();

  // Hide navigation panel
  const navPanel = document.getElementById('nav-panel');
  navPanel.classList.add('hidden');

  // Clear user marker if not manually placed
  if (userMarker && !lastUserPosition) {
    map.removeLayer(userMarker);
    userMarker = null;
  }
}

function updateGPSButton() {
  const gpsBtn = document.getElementById('gps-btn');
  if (isNavigating) {
    gpsBtn.textContent = '🛑';
    gpsBtn.title = 'Stop Navigation';
    gpsBtn.style.background = 'rgba(255,107,53,0.15)';
    gpsBtn.style.borderColor = 'rgba(255,107,53,0.4)';
    gpsBtn.style.color = 'var(--clr-accent2)';
  } else {
    gpsBtn.textContent = '📍';
    gpsBtn.title = 'Start GPS Navigation';
    gpsBtn.style.background = 'rgba(255,255,255,0.04)';
    gpsBtn.style.borderColor = 'var(--clr-border)';
    gpsBtn.style.color = 'var(--clr-muted)';
  }
}


// ────────────────────────────────────────────────────────────
// 6. UI LOGIC
// ────────────────────────────────────────────────────────────

const startSelect = document.getElementById('start-select');
const endSelect   = document.getElementById('end-select');
const routeBtn    = document.getElementById('route-btn');
const clearBtn    = document.getElementById('clear-btn');
const statusText  = document.getElementById('status-text');
const statusDist  = document.getElementById('status-dist');
const statusIcon  = document.getElementById('status-icon');

LOCATIONS.forEach(loc => {
  startSelect.appendChild(new Option(loc.name, loc.id));
  endSelect.appendChild(new Option(loc.name, loc.id));
});

document.getElementById('swap-btn').addEventListener('click', () => {
  [startSelect.value, endSelect.value] = [endSelect.value, startSelect.value];
});

const graph = buildGraph();

routeBtn.addEventListener('click', () => {
  const sId = startSelect.value;
  const eId = endSelect.value;

  if (!sId || !eId) { setStatus('⚠', 'Select both a start and destination.', null); return; }
  if (sId === eId)  { setStatus('🤔', "You're already there!", null); return; }

  const sLoc = LOCATIONS.find(l => l.id === sId);
  const eLoc = LOCATIONS.find(l => l.id === eId);
  const snapS = NODES[sId] ? sId : nearestNode(sLoc.lat, sLoc.lng);
  const snapE = NODES[eId] ? eId : nearestNode(eLoc.lat, eLoc.lng);

  const path = dijkstra(graph, snapS, snapE);
  const tracedGraph = buildLocationAwareTraceGraph(snapS, snapE);
  const tracedPath = dijkstra(tracedGraph, snapS, snapE);
  const tracedRouteLatLngs = tracedPath ? buildTracedRoutePath(tracedPath) : null;

  if (!path || path.length < 2) {
    setStatus('❌', `No route found: ${sLoc.name} → ${eLoc.name}`, null);
    clearRoute();
    return;
  }

  const routeOverride = getRoutePathOverride(sId, eId);
  const gateRouteLatLngs = (sId === 'gate1' || eId === 'gate1')
    ? normalizeRenderedRoute(snapS, snapE, routeOverride)
    : null;
  const traceRouteLatLngs = tracedRouteLatLngs
    ? normalizeRenderedRoute(snapS, snapE, tracedRouteLatLngs)
    : null;
  const routeLatLngs = gateRouteLatLngs || traceRouteLatLngs || routeOverride || buildFullRoadPath(path);
  const totalDist = routeLatLngs ? getPathDistance(routeLatLngs) : getRouteDistance(path);

  drawRoute(path, routeLatLngs);
  currentRouteSteps = buildRouteSteps(path, sLoc.name, eLoc.name);
  const nextInstruction = currentRouteSteps[1] || currentRouteSteps[0];
  placeEndpointMarkers(snapS, snapE);
  map.fitBounds(
    L.latLngBounds(routeLatLngs),
    { padding: [90, 90] }
  );

  const walkMin = Math.ceil(totalDist / 1.2 / 60);
  setStatus('🟢',
    `${sLoc.name} → ${eLoc.name} · ${nextInstruction.text} · ~${walkMin} min walk`,
    formatDistance(totalDist)
  );

  // Auto-start navigation if on mobile and GPS is available
  if (window.innerWidth <= 768 && navigator.geolocation) {
    setTimeout(() => {
      if (confirm('Would you like to start GPS navigation to your destination?')) {
        startNavigation(eLoc);
      }
    }, 1000);
  }
});

clearBtn.addEventListener('click', () => {
  startSelect.value = '';
  endSelect.value   = '';
  clearRoute();
  setStatus('📍', 'Select a start and destination to find the shortest path.', null);
});

const stopNavBtn = document.getElementById('stop-nav-btn');
stopNavBtn.addEventListener('click', () => {
  stopNavigation();
  setStatus('🛑', 'Navigation stopped.', null);
});

const gpsBtn = document.getElementById('gps-btn');

gpsBtn.addEventListener('click', () => {
  if (isNavigating) {
    // If already navigating, stop navigation
    stopNavigation();
    setStatus('🛑', 'Navigation stopped.', null);
    return;
  }

  if (!navigator.geolocation) {
    setStatus('❌', 'Geolocation is not supported by this browser.', null);
    return;
  }

  const destinationId = endSelect.value;
  if (!destinationId) {
    setStatus('⚠', 'Please select a destination first.', null);
    return;
  }

  const destination = LOCATIONS.find(l => l.id === destinationId);
  if (!destination) {
    setStatus('❌', 'Invalid destination selected.', null);
    return;
  }

  setStatus('🧭', 'Starting GPS navigation...', null);
  startNavigation(destination);
});

function setStatus(icon, text, dist) {
  statusIcon.textContent = icon;
  statusText.textContent = text;
  if (dist) { statusDist.textContent = dist; statusDist.classList.remove('hidden'); }
  else       { statusDist.classList.add('hidden'); }
}

// ────────────────────────────────────────────────────────────
// USER MENU INITIALIZATION
// ────────────────────────────────────────────────────────────
function initializeUserMenu() {
  const user = authManager.getUser();
  const userMenu = document.getElementById('user-menu');
  const logoutBtn = document.getElementById('logout-btn');

  if (!user || !userMenu) return;
  const trigger = userMenu.querySelector('.user-menu-trigger');

  // Populate user menu
  const userName = userMenu.querySelector('.user-name');
  const menuName = userMenu.querySelector('.user-menu-name');
  const menuEmail = userMenu.querySelector('.user-menu-email');

  if (userName) userName.textContent = user.name;
  if (menuName) menuName.textContent = user.name;
  if (menuEmail) menuEmail.textContent = user.email;

  // Show user menu
  userMenu.classList.remove('hidden');

  const setMenuOpen = (isOpen) => {
    userMenu.classList.toggle('open', isOpen);
    if (trigger) trigger.setAttribute('aria-expanded', String(isOpen));
  };

  if (trigger) {
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      setMenuOpen(!userMenu.classList.contains('open'));
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setMenuOpen(!userMenu.classList.contains('open'));
      } else if (event.key === 'Escape') {
        setMenuOpen(false);
        trigger.blur();
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (!userMenu.contains(event.target)) setMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuOpen(false);
  });

  // Logout handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        authManager.logout();
      }
    });
  }
}

// Initialize user menu when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUserMenu);
} else {
  initializeUserMenu();
}
