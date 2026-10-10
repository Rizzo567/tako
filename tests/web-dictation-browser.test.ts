import { describe,it,expect,vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
function setup(supported=true){
 const instances:FakeSpeech[]=[]
 class FakeSpeech {onstart:()=>void=()=>{};onend:()=>void=()=>{};onerror:(e:unknown)=>void=()=>{};onresult:(e:unknown)=>void=()=>{};start=vi.fn(()=>this.onstart());stop=vi.fn(()=>this.onend());abort=vi.fn();constructor(){instances.push(this)}}
 const socket=vi.fn();const window:Record<string,unknown>={io:socket,...(supported?{SpeechRecognition:FakeSpeech}:{})};const context={window,document:{getElementById:()=>true},React:{},console,setTimeout,clearTimeout,fetch:vi.fn()};runInNewContext(readFileSync('apps/dashboard/public/staff/src/08-dictation.js','utf8'),context)
 const Recorder=window.TakoBrowserDictationRecorder as new (opts?:unknown)=>{start:()=>Promise<void>;stop:()=>Promise<{text:string;previewOnly:boolean}>;cancel:()=>void};return {Recorder,instances,socket}
}
describe('Browser web dictation without actual microphone capture',()=>{
 it('returns final text as preview without opening ASR socket',async()=>{const s=setup();const recorder=new s.Recorder();await recorder.start();const results=[Object.assign([{transcript:'Dodici ravioli'}],{isFinal:true})];s.instances[0]!.onresult({resultIndex:0,results});const result=await recorder.stop();expect(result.text).toBe('Dodici ravioli');expect(result.previewOnly).toBe(true);expect(s.socket).not.toHaveBeenCalled()})
 it('unsupported API fails with typed fallback',async()=>{await expect(new(setup(false).Recorder)().start()).rejects.toThrow('Scrivi nel campo')})
 it('cancel aborts recognition and suppresses transcription callbacks',async()=>{const s=setup();const callback=vi.fn();const recorder=new s.Recorder({onSpeechEnd:callback});await recorder.start();recorder.cancel();expect(s.instances[0]!.abort).toHaveBeenCalledOnce();expect(s.instances[0]!.onresult).toBeNull();expect(callback).not.toHaveBeenCalled()})
 it('permission denial rejects without successful transcript',async()=>{const s=setup();const recorder=new s.Recorder();await recorder.start();s.instances[0]!.onerror({error:'not-allowed'});await expect(recorder.stop()).rejects.toThrow('Permesso microfono negato')})
})
