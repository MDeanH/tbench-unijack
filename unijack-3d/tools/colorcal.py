import sys, numpy as np
from PIL import Image
tex=np.asarray(Image.open("assets/tex/base-top.webp").convert("RGB")).astype(float)
ren=np.asarray(Image.open(sys.argv[1]).convert("RGB").resize((tex.shape[1],tex.shape[0]))).astype(float)
mx,mn=tex.max(axis=2),tex.min(axis=2); sat=(mx-mn)/np.maximum(mx,1)
mask=(sat>0.45)&(tex[...,2]>tex[...,0]+25)
def lin(a): a=a/255.0; return np.where(a<=0.04045,a/12.92,((a+0.055)/1.055)**2.4)
mt=tex[mask].mean(axis=0); mr=ren[mask].mean(axis=0)
lt=lin(tex[mask]).mean(axis=0); lr=lin(ren[mask]).mean(axis=0)
print("mask px:",mask.sum())
print("mean sRGB  photo  :",mt.round(1)," render:",mr.round(1)," ratio:",(mr/mt).round(3))
print("mean linear photo :",lt.round(4)," render:",lr.round(4)," ratio:",(lr/lt).round(3))
print("luminance ratio (linear, Rec709): %.3f"%((lr@[.2126,.7152,.0722])/(lt@[.2126,.7152,.0722])))
