import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installFoundry, environment, fakeNode, deferred, tick } from "./helpers.js";
installFoundry();
const { SoundPad } = await import("../scripts/SoundPad.js");
const { getService } = await import("../scripts/socket-handler.js");
const { library, newEntry } = await import("../scripts/library.js");
const { StatusTracker } = await import("../scripts/status.js");
const { addSceneControl, renderSceneLauncher, registerSoundPadLauncher } = await import("../scripts/launcher.js");
let env, pad, first, second, nodes, tracker;
const root = new URL("../", import.meta.url);
const read = name => readFileSync(new URL(name, root), "utf8");
const change = (field, value) => ({ target: { dataset: { field }, value } });
const packet = (id, action="playSound", userId="player", volume=.4) => ({requestId:id, action, userId, data:{volume}, volume});
const ack = (id, seq=1, extra={}) => ({requestId:id,userId:"player",clientId:"tab",seq,status:"playing",muted:false,factor:1,...extra});
beforeEach(async () => {
  env = environment(); globalThis.game = env; SoundPad.instance = null;
  globalThis.ui = {notifications:{error(){}}}; globalThis.Hooks = {on(){},once(){}};
  globalThis.document = {createElement:()=>fakeNode()};
  foundry.utils.fromUuid = async uuid => uuid === env.sound.uuid ? env.sound : {...env.sound,uuid,name:"Rain",path:"rain.ogg"};
  await getService().dispose(); getService().tracker.listeners.clear();
  pad = new SoundPad(); pad.data = await library.ensure();
  first = newEntry(env.sound); second = newEntry({...env.sound,uuid:"Playlist.p.PlaylistSound.rain",name:"Rain",volume:.15});
  await pad.mutate(data => data.pads[0].sounds.push(first,second)); pad.selectedSoundId = first.id; pad.targetIds = ["player"];
  nodes = Object.fromEntries([".recipient-status",".csm-live-reports",".csm-status-summary",".csm-status-warnings",".preview-status",".volume-value",".csm-unsaved"].map(key=>[key,fakeNode()]));
  pad.element = {querySelector:s=>nodes[s] ?? null,querySelectorAll:()=>[]};
  tracker = new StatusTracker();
});
afterEach(async()=>{tracker.clear();getService().tracker.listeners.clear();await getService().dispose();});
test("selecting B does not send a command, rewrite A's report, or change the live slider",async()=>{
  await getService().play("player",first.uuid,{label:"Thunder"});
  pad.liveVolume=.3;
  await pad.dispatch("selectSound",{dataset:{id:second.id}});
  assert.equal(env.emitted.length,1); assert.equal(getService().tracker.rows()[0].label,"Thunder");
  assert.equal(pad.liveVolume,.3); assert.equal((await pad._prepareContext({})).savedLabel,"Rain");
});
test("live volume with B selected changes recipient audio only, not either sound preset",async()=>{
  await pad.dispatch("selectSound",{dataset:{id:second.id}});
  const before=library.read(); await pad.onChange(change("liveVolume","0.3"));
  assert.deepEqual(library.read(),before);
  assert.equal(env.emitted.at(-1).data.action,"changeVolume");assert.equal(env.emitted.at(-1).data.userId,"player");
  assert.equal(env.emitted.at(-1).data.volume,.3**1.5);
});
test("runtime volume works with no selected sound",async()=>{
  pad.selectedSoundId=null;await pad.onChange(change("liveVolume","0"));
  assert.equal(env.emitted.at(-1).data.volume,0);
});
test("saving preset volume changes future starts only",async()=>{
  pad.field=name=>({alias:{value:"Alias"},category:{value:"Weather"},repeat:{value:"no"},fadeIn:{value:"1"},fadeOut:{value:"2"},presetVolume:{value:"0.5"}}[name]);
  await pad.dispatch("savePreset"); assert.equal(env.emitted.length,0);
  assert.equal(pad.selected.volume,.5**1.5);assert.equal(pad.selected.loop,false);
});
test("preset volume remains a draft until Save and Cancel discards it",async()=>{
  const before=library.read();pad.captureDraft(change("presetVolume","0.1").target);
  assert.deepEqual(library.read(),before);assert.equal(env.emitted.length,0);
  assert.equal((await pad._prepareContext({})).savedPercent,Math.round(.4**(1/1.5)*100));
  await pad.dispatch("cancelEdit");assert.equal(pad.drafts.size,0);
});
test("Play uses saved preset while a different draft is open",async()=>{
  pad.captureDraft(change("alias","DRAFT").target);pad.captureDraft(change("presetVolume","0.1").target);
  await pad.dispatch("playSound");assert.equal(env.emitted.at(-1).data.data.volume,.4);
  assert.equal(getService().tracker.rows()[0].label,"Thunder");
});
test("stop has recipient scope even when selected B never played",async()=>{
  await pad.dispatch("selectSound",{dataset:{id:second.id}});await pad.dispatch("stopSound");
  assert.equal(env.emitted.length,1);assert.equal(env.emitted[0].data.action,"stopSound");assert.equal(env.emitted[0].data.userId,"player");
});
test("selection of another target does not rename old reports or stop old recipients",async()=>{
  await getService().play("player",first.uuid,{label:"Thunder"});
  pad.targetIds=["other"];pad.renderStatus();
  assert.match(nodes[".csm-live-reports"].children[0].textContent,/NoPlaybackReport/);
  assert.match(nodes[".recipient-status"].children[0].textContent,/Player: Thunder/);
  await pad.dispatch("stopSound");assert.equal(env.emitted.at(-1).data.userId,"other");
});
test("live gesture aborts rather than routing to a changed recipient selection",async()=>{
  const target=change("liveVolume","0.1").target;pad.volumeGestures.set(target,pad.targetRevision);pad.targetRevision++;
  await assert.rejects(pad.onChange({target}),/TargetsChanged/);assert.equal(env.emitted.length,0);
});
test("invalid live volume does not emit",async()=>{
  for(const v of ["NaN","Infinity","-1","2"])await assert.rejects(pad.onChange(change("liveVolume",v)));
  assert.equal(env.emitted.length,0);
});
test("empty target selection cannot send live volume",async()=>{pad.targetIds=[];await assert.rejects(pad.onChange(change("liveVolume",".4")));assert.equal(env.emitted.length,0);});
test("preview identity survives selection change and stops separately",async()=>{
  await pad.dispatch("preview");await pad.dispatch("selectSound",{dataset:{id:second.id}});
  assert.equal(getService().previewLabel,"Thunder");assert.equal(env.emitted.length,0);
  await pad.dispatch("togglePreview");assert.equal(getService().preview.current,null);
});
test("natural preview end allows the toggle to start another preview",async()=>{
  await pad.dispatch("togglePreview");env.created.at(-1).end();
  assert.equal(getService().previewIntent,null);await pad.dispatch("togglePreview");assert.equal(env.created.length,2);
});
test("preview toggle can cancel a still-resolving document",async()=>{
  const gate=deferred();foundry.utils.fromUuid=()=>gate.promise;
  const pending=pad.dispatch("togglePreview");await tick();await pad.dispatch("togglePreview");gate.resolve(env.sound);
  assert.equal(await pending,false);assert.equal(env.created.length,0);
});
test("failed preview resolution releases pending toggle state",async()=>{
  foundry.utils.fromUuid=async()=>null;await assert.rejects(pad.dispatch("preview"));assert.equal(getService().previewIntent,null);
});
test("removing the selected entry does not stop existing audio",async()=>{
  await getService().play("gm",first.uuid);await pad.dispatch("removeSound",{dataset:{id:first.id}});
  assert.equal(getService().playback.current.sound.playing,true);assert.equal(pad.selected,null ?? undefined);
});
test("modified group becomes individual selection without overwriting saved group",async()=>{
  await pad.mutate(d=>d.groups.push({id:"g",name:"Party",userIds:["player"]}));pad.groupId="g";
  pad.element.querySelectorAll=()=>[{value:"other"}];await pad.onChange(change("target","other"));
  assert.equal(pad.groupId,"");assert.equal(pad.groupEditId,"g");assert.deepEqual(library.read().groups[0].userIds,["player"]);
  assert.equal((await pad._prepareContext({})).canUpdateGroup,true);
});
test("explicit group update persists changed recipients",async()=>{
  await pad.mutate(d=>d.groups.push({id:"g",name:"Party",userIds:["player"]}));pad.groupEditId="g";pad.targetIds=["other"];
  pad.field=()=>({value:"Party"});await pad.dispatch("updateGroup");assert.deepEqual(library.read().groups[0].userIds,["other"]);
});
test("stop status retains last sound identity, never selected identity",()=>{
  tracker.track(packet("play"),"Thunder");const stop=tracker.track(packet("stop","stopSound"));
  assert.equal(stop.label,"Thunder");assert.equal(tracker.rows()[0].action,"stopSound");
});
test("late volume acknowledgement cannot relabel the new sound's requested volume",()=>{
  tracker.track(packet("play"),"Thunder");tracker.track(packet("vol","changeVolume","player",.2));
  tracker.track(packet("new","playSound","player",.9),"Rain");tracker.accept(ack("vol",1,{status:"volumeChanged"}));
  assert.equal(tracker.rows()[0].volume,.9);assert.equal(tracker.rows()[0].label,"Rain");
});
test("acknowledged volume does not hide the original end report",()=>{
  tracker.track(packet("play"),"Thunder");tracker.accept(ack("play"));tracker.track(packet("vol","changeVolume","player",.2));
  tracker.accept(ack("vol",1,{status:"volumeChanged"}));assert.equal(tracker.rows()[0].volume,.2);
  tracker.accept(ack("play",2,{status:"ended"}));assert.equal(tracker.rows()[0].status,"ended");
});
test("warnings remain visible while details are collapsed",()=>{
  const t=getService().tracker;const record=t.track(packet("x"),"Thunder");t.mark(record,"noResponse");pad.renderStatus();
  assert.equal(nodes[".csm-status-warnings"].hidden,false);assert.match(nodes[".csm-status-warnings"].textContent,/noResponse/);
});
test("all original 18 actions are still registered and have an accessible UI route",()=>{
  const template=read("templates/soundpad.html");
  for(const action of ["selectSound","playSound","stopSound","clearSounds","newPad","renamePad","deletePad","favorite","removeSound","moveUp","moveDown","savePreset","preview","stopPreview","panic","saveGroup","deleteGroup","selectOnline"]){
    assert.ok(SoundPad.DEFAULT_OPTIONS.actions[action],action);
    assert.ok(template.includes(`data-action="${action}"`)||["preview","stopPreview"].includes(action)&&template.includes('data-action="togglePreview"'),action);
  }
});
test("new template has disjoint preset, next-start and live scopes",()=>{
  const text=read("templates/soundpad.html");assert.ok(text.includes('data-field="presetVolume"'));assert.ok(text.includes('data-field="liveVolume"'));
  assert.ok(!text.includes('data-field="volume"'));assert.ok(text.includes('{{savedLabel}}'));
  assert.ok(!text.slice(text.indexOf('<div class="csm-live">')).includes('{{selected.label}}'));
});
test("branding and technical identity remain consistent",()=>{
  const module=JSON.parse(read("module.json"));assert.equal(module.id,"chris-sound-module");assert.equal(module.title,"Chris SoundPad");
  for(const lang of ["de","en"]){const c=JSON.parse(read(`lang/${lang}.json`)).CHRIS_SOUND_MODULE;assert.equal(c.Setting.SoundPadLabel,"Chris SoundPad");assert.ok(c.Setting.OpenSoundPad.includes("Chris SoundPad"));}
});
test("first-column registration is idempotent and does not modify other controls",()=>{
  const tokens={name:"tokens",order:0,tools:{select:{}}};const controls={tokens};addSceneControl(controls);addSceneControl(controls);
  assert.equal(controls.tokens,tokens);assert.equal(Object.keys(controls).length,2);assert.equal(controls["chris-sound-module"].icon,"fa-solid fa-headphones");
  env.user=env.users.get("player");addSceneControl(controls);assert.deepEqual(Object.keys(controls),["tokens"]);
});
test("scene hook captures only our button and never activates a canvas tool",async()=>{
  const control={listeners:[],disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},matches:()=>true,addEventListener(...args){this.listeners.push(args);}};
  renderSceneLauncher({}, {querySelector:()=>control});renderSceneLauncher({}, {querySelector:()=>control});
  assert.equal(control.listeners.length,1);assert.equal(control.listeners[0][2].capture,true);
  pad.rendered=true;pad.bringToFront=()=>{pad.foreground=true;};
  let stopped=0;await control.listeners[0][1]({preventDefault(){},stopPropagation(){},stopImmediatePropagation(){stopped++;}});await tick();
  assert.equal(stopped,1);assert.equal(pad.foreground,true);assert.equal(env.emitted.length,0);
});
test("left button is removed for a player and absent markup is harmless",()=>{
  let removed=false;env.user=env.users.get("player");renderSceneLauncher({}, {querySelector:()=>({remove(){removed=true;}})});
  assert.equal(removed,true);assert.doesNotThrow(()=>renderSceneLauncher({},{}));
});
test("registration covers playlist, scene-control data and scene rendering hooks once",()=>{
  const names=[];globalThis.Hooks={on:name=>names.push(name)};registerSoundPadLauncher();registerSoundPadLauncher();
  assert.deepEqual(names,["renderPlaylistDirectory","getSceneControlButtons","renderSceneControls"]);
});

test("legacy volume event is runtime-only and cannot create a preset draft",async()=>{
  await pad.onChange(change("volume","0.25"));
  assert.equal(pad.drafts.size,0);assert.equal(library.read().pads[0].sounds[0].volume,.4);
  assert.equal(env.emitted.at(-1).data.volume,.25**1.5);
});
