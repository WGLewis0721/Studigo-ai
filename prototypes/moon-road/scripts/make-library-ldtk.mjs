// One-time bootstrap of art-source/poc-xi/moon-library.ldtk. After this the .ldtk file is the source of truth:
// open it in LDtk, edit, save, then run: node scripts/ldtk-export.mjs
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const out = join(dirname(fileURLToPath(import.meta.url)), '../art-source/poc-xi/moon-library.ldtk');
const W = 30, H = 17, G = 32;
const cells = Array.from({length: H}, (_, y) => Array.from({length: W}, (_, x) => (x === 0 || x === W - 1 || y === 0 || y >= H - 2 ? 1 : 0)));
for (const [x, y, n] of [[4, 12, 5], [10, 12, 5], [16, 12, 5], [22, 9, 5]]) for (let i = 0; i < n; i++) cells[y][x + i] = 2;
for (let y = 11; y <= 14; y++) cells[y][0] = 0;

let uid = 100;
const U = () => uid++;
const field = (identifier, type, def = null) => ({identifier, doc: null, __type: type, uid: U(), type: `F_${type}`, isArray: false, canBeNull: false,
  arrayMinLength: null, arrayMaxLength: null, editorDisplayMode: 'Hidden', editorDisplayScale: 1, editorDisplayPos: 'Above', editorLinkStyle: 'StraightArrow',
  editorDisplayColor: null, editorAlwaysShow: false, editorShowInWorld: true, editorCutLongValues: true, editorTextSuffix: null, editorTextPrefix: null,
  useForSmartColor: false, exportToToc: false, searchable: false, min: null, max: null, regex: null, acceptFileTypes: null,
  defaultOverride: def === null ? null : {id: type === 'Int' ? 'V_Int' : 'V_String', params: [def]}, textLanguageMode: null, symmetricalRef: false,
  autoChainRef: true, allowOutOfLevelRef: true, allowedRefs: 'OnlySame', allowedRefsEntityUid: null, allowedRefTags: [], tilesetUid: null});
const entityDef = (identifier, color, w, h, fields, extra = {}) => ({identifier, uid: U(), tags: [], exportToToc: false, allowOutOfBounds: false, doc: null, color,
  width: w, height: h, resizableX: false, resizableY: false, minWidth: null, maxWidth: null, minHeight: null, maxHeight: null, keepAspectRatio: false,
  tileOpacity: 1, fillOpacity: 0.3, lineOpacity: 1, hollow: false, renderMode: 'Rectangle', showName: true, tilesetId: null, tileRenderMode: 'FitInside',
  tileRect: null, uiTileRect: null, nineSliceBorders: [], maxCount: 0, limitScope: 'PerLevel', limitBehavior: 'MoveLastOne', pivotX: 0, pivotY: 0,
  fieldDefs: fields, ...extra});
const defs = {
  skeleton: entityDef('Skeleton', '#E8E0C8', 32, 32, [field('a', 'Int', 2), field('b', 'Int', 2), field('range', 'Int', 3)]),
  bat: entityDef('Bat', '#8A78C8', 32, 32, [field('a', 'Int', 1), field('b', 'Int', 2), field('range', 'Int', 4)]),
  item: entityDef('Item', '#E6B860', 32, 32, [field('itemId', 'String', 'tank5'), field('kind', 'String', 'tank'), field('via', 'String', '')]),
  block: entityDef('Block', '#9FB6C9', 96, 64, [field('blockId', 'String', 'block-12'), field('product', 'Int', 12)], {resizableX: true, resizableY: true}),
  shrine: entityDef('Shrine', '#3F8A78', 32, 32, [field('shrineId', 'String', 'shrine-T'), field('orbs', 'String', '2,3')]),
  prop: entityDef('Prop', '#B07A56', 32, 32, [field('frame', 'String', 'shelf.png')], {pivotY: 1}),
};
const layer = (identifier, type, extra = {}) => ({__type: type, identifier, type, uid: U(), doc: null, uiColor: null, gridSize: G,
  guideGridWid: 0, guideGridHei: 0, displayOpacity: 1, inactiveOpacity: 0.6, hideInList: false, hideFieldsWhenInactive: true, canSelectWhenInactive: true,
  renderInWorldView: true, pxOffsetX: 0, pxOffsetY: 0, parallaxFactorX: 0, parallaxFactorY: 0, parallaxScaling: true, requiredTags: [], excludedTags: [],
  intGridValues: [], intGridValuesGroups: [], autoRuleGroups: [], autoSourceLayerDefUid: null, tilesetDefUid: null, tilePivotX: 0, tilePivotY: 0,
  biomeFieldUid: null, uiFilterTags: [], useAsDefaultPerLevel: false, ...extra});
const collision = layer('Collision', 'IntGrid', {intGridValues: [
  {value: 1, identifier: 'wall', color: '#5A6C8C', tile: null, groupUid: 0}, {value: 2, identifier: 'platform', color: '#E0B36A', tile: null, groupUid: 0}]});
const entities = layer('Entities', 'Entities');

const ent = (def, cx, cy, fields, w = G, h = G) => ({__identifier: def.identifier, __grid: [cx, cy], __pivot: [def.pivotX, def.pivotY], __tags: [], __tile: null,
  __smartColor: def.color, __worldX: cx * G, __worldY: cy * G, iid: randomUUID(), width: w, height: h, defUid: def.uid, px: [cx * G, cy * G],
  fieldInstances: fields.map(([id, type, v]) => {
    const fd = def.fieldDefs.find(f => f.identifier === id);
    return {__identifier: id, __type: type, __value: v, __tile: null, defUid: fd.uid, realEditorValues: [{id: type === 'Int' ? 'V_Int' : 'V_String', params: [v]}]};
  })});
const list = [
  ent(defs.shrine, 5, 14, [['shrineId', 'String', 'shrine-T'], ['orbs', 'String', '2,3']]),
  ent(defs.skeleton, 9, 14, [['a', 'Int', 2], ['b', 'Int', 3], ['range', 'Int', 3]]),
  ent(defs.skeleton, 20, 14, [['a', 'Int', 4], ['b', 'Int', 1], ['range', 'Int', 3]]),
  ent(defs.bat, 18, 6, [['a', 'Int', 1], ['b', 'Int', 4], ['range', 'Int', 4]]),
  ent(defs.block, 23, 7, [['blockId', 'String', 'block-12'], ['product', 'Int', 12]], 96, 64),
  ent(defs.item, 24, 8, [['itemId', 'String', 'tank5'], ['kind', 'String', 'tank'], ['via', 'String', 'block-12']]),
  ...[3, 12, 27].map(x => ent(defs.prop, x, 15, [['frame', 'String', 'shelf.png']])),
  ent(defs.prop, 8, 3, [['frame', 'String', 'lantern.png']]),
  ent(defs.prop, 15, 3, [['frame', 'String', 'lantern.png']]),
  ent(defs.prop, 14, 15, [['frame', 'String', 'lectern.png']]),
  ent(defs.prop, 17, 15, [['frame', 'String', 'books.png']]),
];
const layerInst = (def, extra) => ({__identifier: def.identifier, __type: def.__type, __cWid: W, __cHei: H, __gridSize: G, __opacity: 1, __pxTotalOffsetX: 0, __pxTotalOffsetY: 0,
  __tilesetDefUid: null, __tilesetRelPath: null, iid: randomUUID(), levelId: 1, layerDefUid: def.uid, pxOffsetX: 0, pxOffsetY: 0, visible: true, optionalRules: [],
  intGridCsv: [], autoLayerTiles: [], seed: 4242, overrideTilesetUid: null, gridTiles: [], entityInstances: [], ...extra});
const project = {__header__: {fileType: 'LDtk Project JSON', app: 'LDtk', doc: 'https://ldtk.io/json', schema: 'https://ldtk.io/files/JSON_SCHEMA.json', appAuthor: 'Sebastien Benard', appVersion: '1.5.3', url: 'https://ldtk.io'},
  iid: randomUUID(), jsonVersion: '1.5.3', appBuildId: 473703, nextUid: uid + 10, identifierStyle: 'Capitalize', toc: [], worldLayout: 'Free', worldGridWidth: 960, worldGridHeight: 544,
  defaultLevelWidth: 960, defaultLevelHeight: 544, defaultPivotX: 0, defaultPivotY: 0, defaultGridSize: G, defaultEntityWidth: G, defaultEntityHeight: G, bgColor: '#0A1322',
  defaultLevelBgColor: '#0A1322', minifyJson: false, externalLevels: false, exportTiled: false, simplifiedExport: false, imageExportMode: 'None', exportLevelBg: true,
  pngFilePattern: null, backupOnSave: false, backupLimit: 10, backupRelPath: null, levelNamePattern: 'Level_%idx', tutorialDesc: null, customCommands: [], flags: [],
  defs: {layers: [entities, collision], entities: Object.values(defs), tilesets: [], enums: [], externalEnums: [], levelFields: []},
  levels: [{identifier: 'T_Moon_Library', iid: randomUUID(), uid: 1, worldX: 0, worldY: 0, worldDepth: 0, pxWid: W * G, pxHei: H * G, __bgColor: '#0A1322', bgColor: null,
    useAutoIdentifier: false, bgRelPath: null, bgPos: null, bgPivotX: 0.5, bgPivotY: 0.5, __smartColor: '#7A92B8', __bgPos: null, externalRelPath: null,
    fieldInstances: [], layerInstances: [layerInst(entities, {entityInstances: list}), layerInst(collision, {intGridCsv: cells.flat()})], __neighbours: []}],
  worldIid: randomUUID(), dummyWorldIid: randomUUID()};
writeFileSync(out, JSON.stringify(project, null, 2) + '\n');
console.log('wrote', out);
