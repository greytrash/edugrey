import os, sys, time, numpy as np
from rembg import remove, new_session
from PIL import Image
model=sys.argv[1]; jobs=sys.argv[2:]
sess=new_session(model)
for j in jobs:
    clip,r=j.split(":"); s,e=map(int,r.split("-"))
    os.makedirs(f"masks/{clip}",exist_ok=True)
    for f in range(s,e+1):
        out=f"masks/{clip}/{f:04d}.png"
        if os.path.exists(out): continue
        t=time.time()
        im=Image.open(f"full{clip}/{f:04d}.png").convert("RGB")
        a=np.array(remove(im,session=sess))[:,:,3]
        Image.fromarray(a).save(out)
        print(clip,f,"%.1fs"%(time.time()-t),flush=True)
print("DONE",model)
