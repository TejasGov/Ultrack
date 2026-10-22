import importlib.util,json,tempfile,unittest,wave,math,struct
from pathlib import Path
spec=importlib.util.spec_from_file_location('bank',Path(__file__).with_name('import_engine_sim.py'));bank=importlib.util.module_from_spec(spec);spec.loader.exec_module(bank)
class RecordingTests(unittest.TestCase):
 def test_validation_and_real_ffmpeg_encode(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);wav=root/'tone.wav'
   with wave.open(str(wav),'wb') as out:
    out.setnchannels(1);out.setsampwidth(2);out.setframerate(48000);out.writeframes(b''.join(struct.pack('<h',int(3000*math.sin(i*2*math.pi*120/48000))) for i in range(48000*3)))
   profile={'cars':['test-car'],'redline':9000,'source':{'author':'Test fixture','url':'https://example.invalid/test','license':'Original test signal'},'loops':{name:{'file':'tone.wav','rpm':rpm,'seconds':2.2} for name,rpm in zip(bank.LAYERS,[1000,2500,5000,8000,5000])}}
   plan={'schemaVersion':1,'profiles':{'test':profile}}
   bank.validate_plan(plan,root)
   output=root/'out';result=bank.build(plan,root,output)
   self.assertEqual(len(result['profiles']['test-car']['loops']),5)
   self.assertEqual(len(list((output/'engines/engine-sim').glob('*.ogg'))),5)
   receipts=json.loads((output/'engine-sim-receipts.json').read_text());self.assertEqual(len(receipts),5)
   profile['loops']['low']['rpm']=500
   with self.assertRaises(ValueError):bank.validate_plan(plan,root)
   profile['loops']['low']['rpm']=float('nan')
   with self.assertRaises(ValueError):bank.validate_plan(plan,root)
if __name__=='__main__':unittest.main()
