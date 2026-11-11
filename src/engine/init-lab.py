import argparse,importlib.util,json,pathlib
here=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('copyengine',here/'lab-copy.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
parser=argparse.ArgumentParser(description='Create a new independent regular-file firmware lab. Never initializes an existing directory.')
parser.add_argument('--source',required=True);parser.add_argument('--lab',required=True)
args=parser.parse_args();marker=m.init_copy(args.source,args.lab)
lab=pathlib.Path(args.lab).resolve();(lab/'native-state').mkdir(mode=0o700);(lab/'native-state/transactions').mkdir(mode=0o700)
m.write_new(lab/'native-lab.txt',b'cmu-native-lab-02\n');m.fsync_dir(lab)
print(json.dumps(marker,indent=2))
