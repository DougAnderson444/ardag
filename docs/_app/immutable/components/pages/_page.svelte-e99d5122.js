import{_ as C}from"../../chunks/preload-helper-aa6bc0ce.js";import{S as D,i as K,s as V,k as R,q as d,a as P,e as h,l as w,r as A,c as E,m as G,h as u,n as j,b as p,I,G as H,J as M,u as J,A as O,K as z,o as F,p as Q}from"../../chunks/index-d3b093d4.js";function S(f){let s,i;return{c(){s=R("p"),i=d(f[2]),this.h()},l(l){s=w(l,"P",{style:!0});var r=G(s);i=A(r,f[2]),r.forEach(u),this.h()},h(){Q(s,"color","red")},m(l,r){p(l,s,r),H(s,i)},p(l,r){r&4&&J(i,l[2])},d(l){l&&u(s)}}}function q(f){let s;return{c(){s=R("pre")},l(i){s=w(i,"PRE",{});var l=G(s);l.forEach(u)},m(i,l){p(i,s,l),s.innerHTML=f[0]},p(i,l){l&1&&(s.innerHTML=i[0])},d(i){i&&u(s)}}}function W(f){let s,i,l,r,b,_=(f[1]?f[1]:"No server URL entered")+"",v,y,U,n,k,m,N,L,T,B,c,a=f[2]&&S(f),o=f[0]&&q(f);return{c(){s=R("br"),i=d("Arweave Gateway URL: "),l=R("input"),r=P(),b=R("br"),v=d(_),y=P(),U=R("br"),n=R("button"),k=d("Run Tests"),N=P(),a&&a.c(),L=P(),o&&o.c(),T=h(),this.h()},l(e){s=w(e,"BR",{}),i=A(e,"Arweave Gateway URL: "),l=w(e,"INPUT",{placeholder:!0}),r=E(e),b=w(e,"BR",{}),v=A(e,_),y=E(e),U=w(e,"BR",{}),n=w(e,"BUTTON",{});var t=G(n);k=A(t,"Run Tests"),t.forEach(u),N=E(e),a&&a.l(e),L=E(e),o&&o.l(e),T=h(),this.h()},h(){j(l,"placeholder","http://localhost:1984"),n.disabled=m=!f[1]},m(e,t){p(e,s,t),p(e,i,t),p(e,l,t),I(l,f[1]),p(e,r,t),p(e,b,t),p(e,v,t),p(e,y,t),p(e,U,t),p(e,n,t),H(n,k),p(e,N,t),a&&a.m(e,t),p(e,L,t),o&&o.m(e,t),p(e,T,t),B||(c=[M(l,"input",f[4]),M(n,"click",f[3])],B=!0)},p(e,[t]){t&2&&l.value!==e[1]&&I(l,e[1]),t&2&&_!==(_=(e[1]?e[1]:"No server URL entered")+"")&&J(v,_),t&2&&m!==(m=!e[1])&&(n.disabled=m),e[2]?a?a.p(e,t):(a=S(e),a.c(),a.m(L.parentNode,L)):a&&(a.d(1),a=null),e[0]?o?o.p(e,t):(o=q(e),o.c(),o.m(T.parentNode,T)):o&&(o.d(1),o=null)},i:O,o:O,d(e){e&&u(s),e&&u(i),e&&u(l),e&&u(r),e&&u(b),e&&u(v),e&&u(y),e&&u(U),e&&u(n),e&&u(N),a&&a.d(e),e&&u(L),o&&o.d(e),e&&u(T),B=!1,z(c)}}}function X(f,s,i){let l="",r,b,_;F(async()=>{({tests:b}=await C(()=>import("../../chunks/index-3015cadc.js"),[],import.meta.url))});async function v(U){if(!b)return;if(!r){i(2,_="Please enter an Arweave Gateway URL to use (localhost:1984 perhaps?)");return}i(2,_=null);const n={log:m=>{console.log(m),i(0,l+=typeof m=="string"?`<br>${m}`:`<br>${JSON.stringify(m)}`)}},k=await b(r,n);n.log(k)}function y(){r=this.value,i(1,r)}return[l,r,_,v,y]}class $ extends D{constructor(s){super(),K(this,s,X,W,V,{})}}export{$ as default};