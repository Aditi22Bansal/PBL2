"use client";
import { useState, useEffect, useRef } from "react";

import { useRouter } from "next/navigation";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Outfit:wght@300;400;500;600&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
:root{
  --cream:#F7F4EE;--cream-dark:#EDE9E0;--cream-mid:#F2EEE6;
  --forest:#1A3A2A;--forest-mid:#234D38;--forest-light:#2E6347;
  --terra:#C4613A;--terra-light:#D4784F;--terra-pale:#FAF0EB;
  --sage:#7BAE94;--sage-pale:#EBF4EF;
  --gold:#C9A84C;--gold-pale:#FBF5E6;
  --ink:#1A2820;--ink-mid:#3A4F44;--ink-muted:#7A9088;
  --border:rgba(26,56,42,0.1);--border-strong:rgba(26,56,42,0.18);
  --r:14px;--r-sm:8px;--r-xl:24px;
}
html{scroll-behavior:smooth;}
body{font-family:'Outfit',sans-serif;background:var(--cream);color:var(--ink);overflow-x:hidden;line-height:1.6;}
body{cursor:none;}
.cursor{position:fixed;width:10px;height:10px;background:var(--terra);border-radius:50%;pointer-events:none;z-index:9999;mix-blend-mode:multiply;}
.cursor-ring{position:fixed;width:36px;height:36px;border:1.5px solid rgba(196,97,58,0.4);border-radius:50%;pointer-events:none;z-index:9998;transition:left 0.12s ease,top 0.12s ease;}
a,button{cursor:none;}

/* NAV */
.nav{position:fixed;top:0;left:0;right:0;z-index:500;display:flex;align-items:center;justify-content:space-between;padding:0 6vw;height:68px;transition:all 0.3s;}
.nav.solid{background:rgba(247,244,238,0.93);backdrop-filter:blur(24px);border-bottom:1px solid var(--border);}
.logo{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:600;color:var(--forest);display:flex;align-items:center;gap:5px;}
.logo-dot{width:8px;height:8px;border-radius:50%;background:var(--terra);margin-bottom:10px;}
.nav-center{display:flex;gap:32px;}
.nav-center a{font-size:14px;font-weight:400;color:var(--ink-mid);text-decoration:none;transition:color 0.2s;}
.nav-center a:hover{color:var(--forest);}
.nav-right{display:flex;gap:10px;align-items:center;}
.btn-text{background:none;border:none;font-family:'Outfit',sans-serif;font-size:14px;color:var(--ink-mid);cursor:none;padding:8px 16px;border-radius:50px;transition:all 0.2s;}
.btn-text:hover{color:var(--forest);background:var(--cream-dark);}
.btn-nav{background:var(--forest);border:none;font-family:'Outfit',sans-serif;font-size:14px;color:white;font-weight:500;cursor:none;padding:10px 22px;border-radius:50px;transition:all 0.2s;}
.btn-nav:hover{background:var(--forest-light);transform:translateY(-1px);box-shadow:0 6px 24px rgba(26,56,42,0.25);}

/* HERO */
.hero{min-height:100vh;display:flex;align-items:center;padding:96px 6vw 80px;position:relative;overflow:hidden;}
.hero-bg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse 60% 55% at 68% 25%,rgba(196,97,58,0.07) 0%,transparent 65%),radial-gradient(ellipse 50% 60% at 20% 78%,rgba(26,56,42,0.05) 0%,transparent 60%);}
.hero-blob{position:absolute;right:-4vw;top:50%;transform:translateY(-50%);width:50vw;height:78vh;z-index:0;background:var(--sage-pale);border-radius:62% 38% 46% 54%/60% 44% 56% 40%;animation:morph 11s ease-in-out infinite alternate;opacity:0.65;}
@keyframes morph{0%{border-radius:62% 38% 46% 54%/60% 44% 56% 40%;}50%{border-radius:43% 57% 68% 32%/48% 62% 38% 52%;}100%{border-radius:38% 62% 57% 43%/35% 67% 33% 65%;}}
.hero-inner{display:grid;grid-template-columns:1fr 1fr;gap:0;align-items:center;width:100%;position:relative;z-index:1;}
.hero-label{display:inline-flex;align-items:center;gap:8px;background:var(--terra-pale);border:1px solid rgba(196,97,58,0.2);border-radius:50px;padding:5px 14px 5px 8px;font-size:12px;font-weight:500;color:var(--terra);margin-bottom:28px;animation:fadeUp 0.6s ease both;}
.hero-chip{background:var(--terra);color:white;font-size:10px;font-weight:600;letter-spacing:0.5px;padding:3px 8px;border-radius:50px;text-transform:uppercase;}
.hero-h1{font-family:'Cormorant Garamond',serif;font-size:clamp(50px,6vw,84px);line-height:1.02;font-weight:600;color:var(--forest);letter-spacing:-2px;margin-bottom:28px;animation:fadeUp 0.7s 0.1s ease both;}
.hero-h1 em{font-style:italic;color:var(--terra);}
.hero-h1 .sub-line{font-size:clamp(26px,2.8vw,42px);font-weight:400;font-style:italic;color:var(--ink-muted);display:block;margin-top:8px;letter-spacing:-1px;}
.hero-p{font-size:16px;line-height:1.8;color:var(--ink-mid);max-width:460px;font-weight:300;margin-bottom:40px;animation:fadeUp 0.7s 0.2s ease both;}
.hero-actions{display:flex;gap:14px;align-items:center;flex-wrap:wrap;animation:fadeUp 0.7s 0.3s ease both;}
.btn-main{display:inline-flex;align-items:center;gap:10px;background:var(--terra);border:none;color:white;font-family:'Outfit',sans-serif;font-size:15px;font-weight:500;padding:14px 28px;border-radius:50px;cursor:none;transition:all 0.25s;box-shadow:0 4px 24px rgba(196,97,58,0.3);}
.btn-main:hover{transform:translateY(-2px);box-shadow:0 12px 36px rgba(196,97,58,0.4);background:var(--terra-light);}
.btn-ghost{display:inline-flex;align-items:center;gap:8px;background:transparent;border:1.5px solid var(--border-strong);color:var(--forest);font-family:'Outfit',sans-serif;font-size:15px;font-weight:400;padding:13px 24px;border-radius:50px;cursor:none;transition:all 0.2s;}
.btn-ghost:hover{border-color:var(--forest);background:white;}
.play-ic{width:28px;height:28px;border-radius:50%;background:rgba(26,56,42,0.08);display:flex;align-items:center;justify-content:center;font-size:10px;}
.hero-trust{display:flex;align-items:center;gap:14px;margin-top:52px;animation:fadeUp 0.7s 0.4s ease both;}
.trust-avs{display:flex;}
.trust-av{width:32px;height:32px;border-radius:50%;border:2px solid var(--cream);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;margin-left:-8px;}
.trust-av:first-child{margin-left:0;}
.trust-txt{font-size:13px;color:var(--ink-muted);line-height:1.4;}
.trust-txt strong{color:var(--forest);font-weight:500;}

/* HERO VISUAL */
.hero-right{display:flex;flex-direction:column;gap:14px;align-items:flex-end;animation:fadeRight 0.9s 0.3s ease both;}
@keyframes fadeRight{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
.pcard{background:white;border:1px solid var(--border);border-radius:20px;padding:22px 24px;box-shadow:0 8px 40px rgba(26,56,42,0.07);}
.pcard-wide{width:340px;}
.pcard-dark{width:260px;background:var(--forest);color:white;margin-left:auto;}
.pc-lbl{font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-muted);margin-bottom:14px;}
.pcard-dark .pc-lbl{color:rgba(255,255,255,0.4);}
.room-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.room-av{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;}
.room-name{font-size:13px;font-weight:500;color:var(--forest);}
.room-tag{font-size:11px;color:var(--ink-muted);}
.cpill{font-size:12px;font-weight:600;padding:3px 10px;border-radius:50px;}
.cpill-hi{background:var(--sage-pale);color:var(--forest-light);}
.cpill-md{background:var(--gold-pale);color:#8A6A1A;}
.assigned-chip{display:inline-flex;align-items:center;gap:5px;background:var(--sage-pale);color:var(--forest-light);border-radius:50px;padding:5px 12px;font-size:12px;font-weight:500;margin-top:10px;}
.score-big{font-family:'Cormorant Garamond',serif;font-size:52px;font-weight:600;color:white;line-height:1;}
.score-sub{font-size:12px;color:rgba(255,255,255,0.45);margin-top:4px;}
.score-bars{display:flex;gap:3px;margin-top:14px;}
.sbar{height:4px;border-radius:2px;flex:1;background:rgba(255,255,255,0.12);}
.sbar.on{background:var(--terra-light);}
@keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}

/* MARQUEE */
.marquee-wrap{overflow:hidden;padding:18px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--cream-dark);}
.marquee-track{display:flex;gap:48px;width:max-content;animation:marquee 24s linear infinite;}
.marquee-track:hover{animation-play-state:paused;}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.mi{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;color:var(--ink-muted);white-space:nowrap;}
.mi-sep{width:5px;height:5px;border-radius:50%;background:var(--terra);opacity:0.35;}

/* FREE BANNER */
.free-banner{background:var(--forest);padding:64px 6vw;display:flex;justify-content:space-between;align-items:flex-start;gap:48px;flex-wrap:wrap;}
.free-tag{display:inline-flex;align-items:center;gap:6px;background:rgba(196,97,58,0.2);color:var(--terra-light);border-radius:50px;padding:4px 12px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:16px;}
.free-dot{width:6px;height:6px;border-radius:50%;background:var(--terra-light);}
.free-h2{font-family:'Cormorant Garamond',serif;font-size:clamp(32px,3.5vw,54px);font-weight:600;color:white;letter-spacing:-1px;line-height:1.1;margin-bottom:16px;}
.free-h2 em{font-style:italic;color:var(--terra-light);}
.free-sub{font-size:15px;color:rgba(255,255,255,0.5);max-width:460px;font-weight:300;line-height:1.8;}
.btn-free{display:inline-flex;align-items:center;gap:8px;background:var(--terra);border:none;color:white;font-family:'Outfit',sans-serif;font-size:15px;font-weight:500;padding:14px 28px;border-radius:50px;cursor:none;margin-top:32px;transition:all 0.25s;box-shadow:0 4px 24px rgba(196,97,58,0.3);}
.btn-free:hover{background:var(--terra-light);transform:translateY(-2px);box-shadow:0 12px 36px rgba(196,97,58,0.45);}
.free-reasons{display:flex;flex-direction:column;gap:12px;min-width:280px;}
.fr-item{display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px;}
.fr-icon{font-size:18px;flex-shrink:0;margin-top:1px;}
.fr-title{font-size:14px;font-weight:500;color:white;margin-bottom:4px;}
.fr-desc{font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;}

/* SECTION SHARED */
.section{padding:96px 6vw;}
.eyebrow{font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--terra);margin-bottom:16px;display:flex;align-items:center;gap:8px;}
.eyebrow::before{content:'';width:20px;height:1.5px;background:var(--terra);}
.sec-h2{font-family:'Cormorant Garamond',serif;font-size:clamp(34px,4vw,58px);font-weight:600;color:var(--forest);letter-spacing:-1.5px;line-height:1.1;margin-bottom:16px;}
.sec-h2 em{font-style:italic;color:var(--terra);}
.sec-sub{font-size:16px;color:var(--ink-mid);max-width:500px;line-height:1.75;font-weight:300;}

/* WORKS */
.works-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:64px;background:var(--border);border-radius:var(--r-xl);overflow:hidden;border:1px solid var(--border);}
.wcard{background:var(--cream);padding:40px 28px;transition:background 0.2s;position:relative;}
.wcard:hover{background:white;}
.wnum{font-family:'Cormorant Garamond',serif;font-size:64px;font-weight:600;color:rgba(26,56,42,0.05);line-height:1;margin-bottom:20px;transition:color 0.2s;}
.wcard:hover .wnum{color:rgba(196,97,58,0.11);}
.wicon{width:48px;height:48px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:18px;}
.wtitle{font-size:16px;font-weight:600;color:var(--forest);margin-bottom:10px;}
.wdesc{font-size:14px;color:var(--ink-muted);line-height:1.65;}

/* ADMIN BENTO */
.admin-section{background:white;padding:96px 6vw;}
.bento{display:grid;grid-template-columns:1.3fr 1fr;grid-template-rows:auto auto;gap:20px;margin-top:64px;}
.bcard{background:var(--cream);border:1px solid var(--border);border-radius:var(--r-xl);padding:36px;overflow:hidden;transition:all 0.25s;position:relative;}
.bcard:hover{transform:translateY(-3px);box-shadow:0 20px 60px rgba(26,56,42,0.09);border-color:var(--border-strong);}
.bcard-tall{grid-row:span 2;}
.bcard-forest{background:var(--forest);}
.bcard-forest .btitle{color:white;}.bcard-forest .bdesc{color:rgba(255,255,255,0.45);}
.bcard-terra{background:var(--terra-pale);}
.bicon{width:52px;height:52px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:24px;}
.bicon-dark{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.12);}
.bicon-light{background:white;border:1px solid var(--border);}
.bicon-terra{background:rgba(196,97,58,0.1);border:1px solid rgba(196,97,58,0.18);}
.btitle{font-size:20px;font-weight:600;color:var(--forest);margin-bottom:10px;line-height:1.3;}
.bdesc{font-size:14px;color:var(--ink-mid);line-height:1.7;font-weight:300;}
.room-cfg{margin-top:28px;display:flex;flex-direction:column;gap:9px;}
.rcfg-row{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 14px;}
.rcfg-left{display:flex;align-items:center;gap:9px;}
.rcfg-name{font-size:13px;color:white;}
.rcfg-badges{display:flex;gap:5px;}
.rbadge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:50px;letter-spacing:0.3px;}
.rbac{background:rgba(123,174,148,0.2);color:var(--sage);}
.rbtri{background:rgba(196,97,58,0.2);color:var(--terra-light);}
.rbdbl{background:rgba(201,168,76,0.18);color:var(--gold);}
.chat-demo{margin-top:24px;display:flex;flex-direction:column;gap:8px;}
.cmsg{max-width:78%;padding:9px 14px;border-radius:14px;font-size:13px;line-height:1.5;}
.cmsg-them{background:white;border:1px solid var(--border);color:var(--ink);align-self:flex-start;border-bottom-left-radius:4px;}
.cmsg-me{background:var(--forest);color:white;align-self:flex-end;border-bottom-right-radius:4px;}
.csender{font-size:10px;color:var(--ink-muted);margin-bottom:2px;}
.cmsg-me .csender{text-align:right;color:rgba(255,255,255,0.35);}

/* STUDENT FEATURES */
.student-section{background:var(--cream-mid);padding:96px 6vw;}
.sgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:64px;}
.scard{background:white;border:1px solid var(--border);border-radius:var(--r-xl);padding:36px;transition:all 0.25s;overflow:hidden;}
.scard:hover{transform:translateY(-4px);box-shadow:0 24px 60px rgba(26,56,42,0.1);}
.snum{font-family:'Cormorant Garamond',serif;font-size:48px;font-weight:600;color:rgba(26,56,42,0.05);margin-bottom:16px;line-height:1;}
.sicon{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:20px;}
.stitle{font-size:18px;font-weight:600;color:var(--forest);margin-bottom:10px;}
.sdesc{font-size:14px;color:var(--ink-muted);line-height:1.7;font-weight:300;}
.stag{display:inline-flex;align-items:center;gap:4px;margin-top:16px;font-size:12px;font-weight:500;color:var(--terra);background:var(--terra-pale);border-radius:50px;padding:4px 10px;}

/* RESULTS */
.results-section{background:var(--forest);padding:96px 6vw;}
.results-section .eyebrow{color:var(--terra-light);}
.results-section .eyebrow::before{background:var(--terra-light);}
.results-section .sec-h2{color:white;}
.results-section .sec-sub{color:rgba(255,255,255,0.45);}
.mstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,0.07);border-radius:var(--r-xl);overflow:hidden;margin-top:64px;border:1px solid rgba(255,255,255,0.07);}
.mcell{background:var(--forest);padding:40px 24px;text-align:center;transition:background 0.2s;}
.mcell:hover{background:var(--forest-mid);}
.mnum{font-family:'Cormorant Garamond',serif;font-size:54px;font-weight:600;color:white;line-height:1;margin-bottom:8px;}
.mnum span{color:var(--terra-light);}
.mlbl{font-size:13px;color:rgba(255,255,255,0.4);line-height:1.5;}
.btable{margin-top:36px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:var(--r);overflow:hidden;}
.bt-hd{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;padding:14px 24px;border-bottom:1px solid rgba(255,255,255,0.07);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.25);}
.bt-rw{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;padding:16px 24px;border-bottom:1px solid rgba(255,255,255,0.05);align-items:center;transition:background 0.15s;}
.bt-rw:last-child{border-bottom:none;}
.bt-rw:hover{background:rgba(255,255,255,0.03);}
.bt-rw.hl{background:rgba(196,97,58,0.1);border-left:2px solid var(--terra-light);}
.bt-m{font-size:14px;font-weight:500;color:white;}
.bt-ms{font-size:12px;color:rgba(255,255,255,0.3);margin-top:2px;}
.bt-v{font-size:14px;color:rgba(255,255,255,0.55);}
.bt-v.best{color:var(--terra-light);font-weight:600;}
.bt-pill{display:inline-flex;font-size:11px;font-weight:600;padding:3px 9px;border-radius:50px;}
.pill-win{background:rgba(196,97,58,0.2);color:var(--terra-light);}
.pill-mid{background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.35);}

/* TESTIMONIALS */
.testi-section{background:var(--cream);padding:96px 6vw;}
.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:64px;}
.tcard{background:white;border:1px solid var(--border);border-radius:var(--r-xl);padding:36px;transition:all 0.2s;}
.tcard:hover{border-color:var(--border-strong);box-shadow:0 8px 40px rgba(26,56,42,0.08);}
.tcard-feat{background:var(--terra);border-color:transparent;}
.tcard-feat .tquote{color:white;}.tcard-feat .tname{color:white;}.tcard-feat .trole{color:rgba(255,255,255,0.45);}
.tstars{font-size:14px;letter-spacing:2px;margin-bottom:20px;}
.tquote{font-family:'Cormorant Garamond',serif;font-size:19px;font-style:italic;color:var(--forest);line-height:1.65;margin-bottom:28px;}
.tauthor{display:flex;align-items:center;gap:12px;}
.tav{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;}
.tname{font-size:14px;font-weight:600;color:var(--forest);}
.trole{font-size:12px;color:var(--ink-muted);margin-top:2px;}

/* ROADMAP */
.rm-section{background:white;padding:96px 6vw;}
.rmlist{display:flex;flex-direction:column;gap:0;margin-top:64px;position:relative;}
.rmlist::before{content:'';position:absolute;left:22px;top:24px;bottom:24px;width:1.5px;background:var(--border);}
.rm-item{display:flex;gap:28px;align-items:flex-start;padding:24px 0;}
.rm-dot{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;z-index:1;border:3px solid var(--cream);}
.rm-dot.done{background:var(--forest);color:white;}
.rm-dot.active{background:var(--terra);color:white;}
.rm-dot.soon{background:var(--cream-dark);border-color:var(--border);color:var(--ink-muted);}
.rm-lbl{font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;}
.rm-lbl.done{color:var(--sage);}
.rm-lbl.active{color:var(--terra);}
.rm-lbl.soon{color:var(--ink-muted);}
.rm-title{font-size:17px;font-weight:600;color:var(--forest);margin-bottom:6px;}
.rm-desc{font-size:14px;color:var(--ink-muted);line-height:1.65;font-weight:300;}

/* CTA */
.cta-section{padding:120px 6vw;text-align:center;background:var(--cream);position:relative;overflow:hidden;}
.cta-bg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse 70% 65% at 50% 50%,rgba(196,97,58,0.07) 0%,transparent 70%);}
.cta-in{position:relative;z-index:1;max-width:700px;margin:0 auto;}
.cta-chip{display:inline-flex;align-items:center;gap:6px;background:var(--gold-pale);border:1px solid rgba(201,168,76,0.25);border-radius:50px;padding:5px 14px;font-size:12px;font-weight:500;color:var(--gold);margin-bottom:28px;}
.cta-h2{font-family:'Cormorant Garamond',serif;font-size:clamp(42px,5vw,72px);font-weight:600;color:var(--forest);letter-spacing:-2px;line-height:1.05;margin-bottom:24px;}
.cta-h2 em{font-style:italic;color:var(--terra);}
.cta-sub{font-size:17px;color:var(--ink-mid);line-height:1.75;font-weight:300;margin-bottom:48px;}
.cta-acts{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}

/* FOOTER */
footer{background:var(--ink);padding:72px 6vw 40px;}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;padding-bottom:48px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:36px;}
.footer-brand{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:600;color:white;display:flex;align-items:center;gap:5px;margin-bottom:12px;}
.footer-brand-dot{width:7px;height:7px;border-radius:50%;background:var(--terra);margin-bottom:8px;}
.footer-about{font-size:13px;color:rgba(255,255,255,0.3);line-height:1.75;max-width:220px;font-weight:300;}
.fcol-head{font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.2);margin-bottom:18px;}
.fcol a{display:block;font-size:13px;color:rgba(255,255,255,0.4);text-decoration:none;margin-bottom:10px;transition:color 0.2s;}
.fcol a:hover{color:white;}
.footer-btm{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:rgba(255,255,255,0.2);}
.res-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:50px;padding:4px 12px;}

/* RESPONSIVE */
@media(max-width:1100px){
  .hero-inner{grid-template-columns:1fr;}.hero-right{display:none;}
  .works-grid{grid-template-columns:repeat(2,1fr);}
  .bento{grid-template-columns:1fr;}.bcard-tall{grid-row:span 1;}
  .sgrid{grid-template-columns:1fr 1fr;}
  .mstrip{grid-template-columns:repeat(2,1fr);}
  .tgrid{grid-template-columns:1fr;}
  .footer-grid{grid-template-columns:1fr 1fr;}
  .free-banner{flex-direction:column;}
}
@media(max-width:680px){
  .nav-center{display:none;}
  .works-grid{grid-template-columns:1fr;}
  .sgrid{grid-template-columns:1fr;}
  .bt-hd,.bt-rw{grid-template-columns:2fr 1fr 1fr;}
  .bt-hd>*:nth-child(n+4),.bt-rw>*:nth-child(n+4){display:none;}
  .footer-grid{grid-template-columns:1fr;}
  .cta-acts{flex-direction:column;align-items:center;}
}
`;

const MARQUEE = [
  "96.6% Avg Compatibility","98.8% Room Coverage","48 Validated Experiments",
  "Real Student Data · SIT Pune","Hill-Climbing Optimization","Greedy Triplet Matching",
  "Cosine Similarity Engine","Zero Unassigned Students","Open to All Institutions",
  "96.6% Avg Compatibility","98.8% Room Coverage","48 Validated Experiments",
  "Real Student Data · SIT Pune","Hill-Climbing Optimization","Greedy Triplet Matching",
  "Cosine Similarity Engine","Zero Unassigned Students","Open to All Institutions",
];

const WORKS = [
  {n:"01",icon:"🏗️",bg:"rgba(123,174,148,0.15)",title:"Configure Your Hostel",desc:"Admin defines blocks, floors, rooms — occupancy type (double/triple/quad), AC, total capacity. The AI respects your real structure."},
  {n:"02",icon:"✍️",bg:"rgba(196,97,58,0.1)",title:"Students Self-Profile",desc:"30-attribute survey covering sleep, hygiene, study habits, personality, noise tolerance. Mobile-friendly, saved automatically."},
  {n:"03",icon:"🧠",bg:"rgba(26,56,42,0.08)",title:"AI Runs the Pipeline",desc:"Feature encoding → cosine similarity matrix → greedy triplet formation → local search optimization → fallback coverage."},
  {n:"04",icon:"✅",bg:"rgba(201,168,76,0.12)",title:"Review & Publish",desc:"Admin gets a full report, reviews scores, can override if needed, then publishes assignments. Students get notified instantly."},
];

const STUDENT_FEATS = [
  {n:"01",icon:"💬",bg:"rgba(26,56,42,0.08)",tag:"Private & encrypted",title:"Roommate Chat",desc:"Secure one-to-one messaging with your room group before move-in. Messages are strictly private — only visible to your assigned roommates."},
  {n:"02",icon:"🏥",bg:"rgba(196,97,58,0.1)",tag:"First-come basis",title:"Special Conditions",desc:"Flag accessibility needs — lower floor for mobility, quiet zone for medical reasons. The AI prioritises within available capacity fairly."},
  {n:"03",icon:"📊",bg:"rgba(123,174,148,0.15)",tag:"Full transparency",title:"Compatibility Breakdown",desc:"See exactly why you were matched. View pairwise scores across lifestyle, personality, and preference dimensions — no black box."},
  {n:"04",icon:"🔔",bg:"rgba(201,168,76,0.12)",tag:"Real-time alerts",title:"Instant Notifications",desc:"Get notified the moment your room is assigned. View room details, amenities, floor, block, and your roommates' profiles in one place."},
  {n:"05",icon:"📝",bg:"rgba(26,56,42,0.08)",tag:"5 minutes",title:"Smart Survey",desc:"Complete your lifestyle profile in under 5 minutes. Guided, intuitive, and adaptive — the survey learns which questions matter most for you."},
  {n:"06",icon:"⚙️",bg:"rgba(196,97,58,0.1)",tag:"Always in control",title:"Preference Updates",desc:"Update preferences before the allocation window closes. Delta-based re-matching means changes are handled without disrupting others."},
];

const ROADMAP_ITEMS = [
  {s:"done",icon:"✓",lbl:"Shipped",title:"Core allocation algorithm",desc:"Cosine similarity + greedy matching + local search + fallback. Validated across 48 runs with real SIT Pune student data."},
  {s:"done",icon:"✓",lbl:"Shipped",title:"Admin portal & hostel configurator",desc:"Room setup, occupancy types, amenity tagging, allocation report dashboard, and manual override system."},
  {s:"active",icon:"◉",lbl:"In progress",title:"Student portal + roommate chat",desc:"Auth-gated student dashboard, lifestyle survey, real-time private messaging with roommates, allocation notifications."},
  {s:"active",icon:"◉",lbl:"In progress",title:"Accessibility & special conditions",desc:"First-come preference system for floor, noise, and accessibility needs with graceful capacity limits and fair queue."},
  {s:"soon",icon:"○",lbl:"Coming soon",title:"Analytics & conflict prediction",desc:"Post-allocation dashboard tracking satisfaction scores, early-conflict indicators, and semester-over-semester improvement trends."},
  {s:"soon",icon:"○",lbl:"Coming soon",title:"Multi-hostel & university-wide deployment",desc:"Federated allocation across multiple hostels and campuses. Central admin with per-hostel warden access controls."},
];

export default function Landing() {
  const [nav, setNav] = useState(false);
  const curRef = useRef(null);
  const ringRef = useRef(null);
  const router = useRouter();
  useEffect(()=>{
    const s=()=>setNav(window.scrollY>30);
    window.addEventListener("scroll",s);
    return()=>window.removeEventListener("scroll",s);
  },[]);
  useEffect(()=>{
    const m=(e: any)=>{
      if(curRef.current){curRef.current.style.left=e.clientX-5+"px";curRef.current.style.top=e.clientY-5+"px";}
      if(ringRef.current){ringRef.current.style.left=e.clientX-18+"px";ringRef.current.style.top=e.clientY-18+"px";}
    };
    window.addEventListener("mousemove",m);
    return()=>window.removeEventListener("mousemove",m);
  },[]);

  return(
    <>
      <style>{CSS}</style>
      <div className="cursor" ref={curRef}/>
      <div className="cursor-ring" ref={ringRef}/>

      {/* NAV */}
      <nav className={`nav${nav?" solid":""}`}>
        <div className="logo">RoomSync<div className="logo-dot"/></div>
        <div className="nav-center">
          <a href="#how-it-works">How it works</a>
          <a href="#for-admins">Admins</a>
          <a href="#for-students">Students</a>
          <a href="#results">Results</a>
          <a href="#roadmap">Roadmap</a>
        </div>
        <div className="nav-right">
          <button className="btn-text" onClick={() => router.push("/login")}>Log in</button>
          <button className="btn-nav" onClick={() => router.push("/register")}>Get free access →</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg"/><div className="hero-blob"/>
        <div className="hero-inner">
          <div>
            <div className="hero-label"><span className="hero-chip">Free</span>Now open for institutional early access</div>
            <h1 className="hero-h1">
              Rooms that feel like<br/><em>home</em> from day one.
              <span className="sub-line">Powered by research.</span>
            </h1>
            <p className="hero-p">RoomSync is a peer-reviewed AI system that matches hostel students by deep lifestyle compatibility — not luck. Built at Symbiosis Institute of Technology. Free for institutions during early access.</p>
            <div className="hero-actions">
              <button className="btn-main" onClick={() => router.push("/register")}>Get free access →</button>
              <button className="btn-ghost"><span className="play-ic">▶</span>See it in action</button>
            </div>
            <div className="hero-trust">
              <div className="trust-avs">
                {[{i:"AS",bg:"#EBF4EF",c:"#2E6347"},{i:"MK",bg:"#FAF0EB",c:"#C4613A"},{i:"AB",bg:"#EDE9E0",c:"#3A4F44"},{i:"RJ",bg:"#E6EEF7",c:"#1A2E45"}].map(a=>(
                  <div className="trust-av" key={a.i} style={{background:a.bg,color:a.c}}>{a.i}</div>
                ))}
              </div>
              <div className="trust-txt"><strong>Research-validated</strong> on real student data<br/>from 48 independent experimental runs</div>
            </div>
          </div>
          <div className="hero-right">
            <div className="pcard pcard-wide">
              <div className="pc-lbl">Compatibility Preview — Room 204</div>
              {[{i:"AS",bg:"#EBF4EF",c:"#2E6347",n:"Aditi S.",t:"CSE · Year 2",p:97,hi:true},{i:"MK",bg:"#FAF0EB",c:"#C4613A",n:"Meera K.",t:"ECE · Year 2",p:94,hi:true},{i:"RV",bg:"#FBF5E6",c:"#8A6A1A",n:"Riya V.",t:"MECH · Year 2",p:88,hi:false}].map(s=>(
                <div className="room-row" key={s.n}>
                  <div className="room-av" style={{background:s.bg,color:s.c}}>{s.i}</div>
                  <div style={{flex:1}}><div className="room-name">{s.n}</div><div className="room-tag">{s.t}</div></div>
                  <div className={`cpill ${s.hi?"cpill-hi":"cpill-md"}`}>{s.p}%</div>
                </div>
              ))}
              <div className="assigned-chip">✓ Block A · Floor 2 · AC · Assigned</div>
            </div>
            <div className="pcard pcard-dark">
              <div className="pc-lbl">Overall Score</div>
              <div className="score-big">0.966</div>
              <div className="score-sub">48 runs · ±0.015 std dev</div>
              <div className="score-bars">{Array.from({length:10}).map((_,i)=><div key={i} className={`sbar${i<9?" on":""}`}/>)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          {MARQUEE.map((m,i)=><div className="mi" key={i}>{m}<div className="mi-sep"/></div>)}
        </div>
      </div>

      {/* FREE BANNER */}
      <div className="free-banner" id="early-access">
        <div>
          <div className="free-tag"><div className="free-dot"/>Early Access Program</div>
          <h2 className="free-h2">Completely free.<br/><em>No strings attached.</em></h2>
          <p className="free-sub">We're in early research phase. We want institutions to run RoomSync on their real datasets — every new dataset makes the model smarter, more generalizable, and more proven. You get a world-class allocation system. We get richer validation.</p>
          <button className="btn-free" onClick={() => router.push("/register")}>Apply for early access →</button>
        </div>
        <div className="free-reasons">
          {[
            {icon:"🔬",t:"Strengthen the research",d:"More real datasets = more robust model. Help us prove this works across institution types, room configurations, and student demographics."},
            {icon:"🏛️",t:"For your hostel, right now",d:"Full admin + student portal, not a toy demo. Solve the real problem your hostel management team faces every semester."},
            {icon:"📈",t:"Become a founding institution",d:"Early partners get priority access to every future feature, forever. You'll have shaped the product from the ground up."},
          ].map(r=>(
            <div className="fr-item" key={r.t}>
              <div className="fr-icon">{r.icon}</div>
              <div><div className="fr-title">{r.t}</div><div className="fr-desc">{r.d}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="section" id="how-it-works" style={{background:"var(--cream)"}}>
        <div className="eyebrow">Process</div>
        <h2 className="sec-h2">Survey to room in<br/><em>minutes, not weeks.</em></h2>
        <p className="sec-sub">A four-stage hybrid pipeline that handles everything — from hostel setup to final assignment — without any manual matching work.</p>
        <div className="works-grid">
          {WORKS.map(w=>(
            <div className="wcard" key={w.n}>
              <div className="wnum">{w.n}</div>
              <div className="wicon" style={{background:w.bg}}>{w.icon}</div>
              <div className="wtitle">{w.title}</div>
              <div className="wdesc">{w.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ADMIN FEATURES */}
      <section className="admin-section" id="for-admins">
        <div className="eyebrow">For Admins</div>
        <h2 className="sec-h2">Everything a warden<br/><em>actually needs.</em></h2>
        <p className="sec-sub">Built for hostel management staff — not engineers. Set up, run, review, and publish allocations with no technical knowledge required.</p>
        <div className="bento">
          <div className="bcard bcard-forest bcard-tall">
            <div className="bicon bicon-dark">🏗️</div>
            <div className="btitle">Hostel Configurator</div>
            <div className="bdesc">Define your exact setup. Add blocks, floors, and rooms — each with occupancy type, AC availability, total capacity, and floor level. The AI respects your real-world constraints.</div>
            <div className="room-cfg">
              {[{n:"Block A — 40 rooms",bs:[{c:"rbac",t:"AC"},{c:"rbtri",t:"Triple"}]},{n:"Block B — 28 rooms",bs:[{c:"rbdbl",t:"Double"},{c:"rbac",t:"AC"}]},{n:"Block C — 36 rooms",bs:[{c:"rbtri",t:"Triple"}]},{n:"Block D — 20 rooms",bs:[{c:"rbdbl",t:"Double"},{c:"rbac",t:"AC"}]}].map(r=>(
                <div className="rcfg-row" key={r.n}>
                  <div className="rcfg-left"><span>🏢</span><span className="rcfg-name">{r.n}</span></div>
                  <div className="rcfg-badges">{r.bs.map(b=><span key={b.t} className={`rbadge ${b.c}`}>{b.t}</span>)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bcard">
            <div className="bicon bicon-light">💬</div>
            <div className="btitle">Roommate Chat — Admin View</div>
            <div className="bdesc">Transparent communication between assigned roommates. Messages stay private within room groups. Admin can see activity but not content — full privacy, zero toxicity blind spots.</div>
            <div className="chat-demo">
              <div className="csender">Meera K.</div>
              <div className="cmsg cmsg-them">Hey! I'm Meera. Early riser, keep things tidy 🙂</div>
              <div className="csender" style={{textAlign:"right"}}>Aditi S.</div>
              <div className="cmsg cmsg-me">Same here! What's your study schedule like?</div>
              <div className="csender">Meera K.</div>
              <div className="cmsg cmsg-them">Usually 9–11pm. Rest of the time I'm pretty quiet</div>
            </div>
          </div>
          <div className="bcard bcard-terra">
            <div className="bicon bicon-terra">🔧</div>
            <div className="btitle">Manual Override Layer</div>
            <div className="bdesc">The AI makes the call, but the warden has the final say. Override any assignment with a reason — overrides are logged, tracked, and feed back into the model to improve future allocations.</div>
          </div>
        </div>
      </section>

      {/* STUDENT FEATURES */}
      <section className="student-section" id="for-students">
        <div className="eyebrow">For Students</div>
        <h2 className="sec-h2">More than a room.<br/><em>A better start.</em></h2>
        <p className="sec-sub">Students get transparency, communication tools, and a real say in their living situation — within a secure, privacy-first platform.</p>
        <div className="sgrid">
          {STUDENT_FEATS.map(f=>(
            <div className="scard" key={f.title}>
              <div className="snum">{f.n}</div>
              <div className="sicon" style={{background:f.bg}}>{f.icon}</div>
              <div className="stitle">{f.title}</div>
              <div className="sdesc">{f.desc}</div>
              <div className="stag">✦ {f.tag}</div>
            </div>
          ))}
        </div>
      </section>

      {/* RESULTS */}
      <section className="results-section" id="results">
        <div className="eyebrow">Research Results</div>
        <h2 className="sec-h2">Numbers that<br/><em>don't lie.</em></h2>
        <p className="sec-sub">Tested against three baseline methods across 48 independent experimental runs using real student survey data from SIT Pune.</p>
        <div className="mstrip">
          {[{n:"0.966",u:"",l:"Avg. compatibility score\nacross all 48 runs"},{n:"98.82",u:"%",l:"Room coverage rate\n— near-complete allocation"},{n:"48",u:"/48",l:"Runs where hybrid model\noutperformed every baseline"},{n:"0–2",u:"",l:"Students left unassigned\nper full semester run"}].map(m=>(
            <div className="mcell" key={m.l}>
              <div className="mnum">{m.n}<span>{m.u}</span></div>
              <div className="mlbl">{m.l}</div>
            </div>
          ))}
        </div>
        <div className="btable">
          <div className="bt-hd"><div>Method</div><div>Avg Score</div><div>Std Dev</div><div>Coverage</div><div>Unassigned</div></div>
          {[
            {m:"Random Allocation",ms:"Baseline — no matching",s:"0.40–0.60",d:"±0.052",c:"~77.5%",u:"10–30",hi:false},
            {m:"K-Means Clustering",ms:"Baseline — group-only",s:"0.92–0.96",d:"±0.015",c:"~85%",u:"5–15",hi:false},
            {m:"Greedy-Only Matching",ms:"Baseline — no local search",s:"0.88–0.93",d:"±0.014",c:"~93.5%",u:"1–5",hi:false},
            {m:"RoomSync Hybrid Model",ms:"Proposed — this system",s:"0.95–0.98",d:"±0.015",c:"97–100%",u:"0–2",hi:true},
          ].map(r=>(
            <div className={`bt-rw${r.hi?" hl":""}`} key={r.m}>
              <div><div className="bt-m">{r.m}</div><div className="bt-ms">{r.ms}</div></div>
              <div className={`bt-v${r.hi?" best":""}`}>{r.s}</div>
              <div className="bt-v">{r.d}</div>
              <div className={`bt-v${r.hi?" best":""}`}>{r.c}</div>
              <div><span className={`bt-pill ${r.hi?"pill-win":"pill-mid"}`}>{r.u}</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testi-section">
        <div className="eyebrow">Early Feedback</div>
        <h2 className="sec-h2">What people are<br/><em>saying.</em></h2>
        <p className="sec-sub">From the research team and early hostel staff who've seen the system in action.</p>
        <div className="tgrid">
          {[
            {feat:true,stars:"★★★★★",q:"The hybrid approach consistently achieved superior average compatibility and coverage — without ever being beaten by a baseline across all 48 experimental runs.",name:"Amol Dhumane",role:"Lead Researcher · SIT Pune",av:"AD",avBg:"rgba(196,97,58,0.3)",avC:"white"},
            {feat:false,stars:"★★★★★",q:"Finally a system that thinks about whether students will actually get along — not just assigns beds. This is exactly what hostel management has been missing.",name:"Hostel Warden",role:"Residential Hall · Pune University",av:"HW",avBg:"#EBF4EF",avC:"#2E6347"},
            {feat:false,stars:"★★★★★",q:"The roommate chat feature alone is a game-changer. Students can introduce themselves before move-in day instead of meeting total strangers.",name:"Student Coordinator",role:"Student Body · Engineering College",av:"SC",avBg:"#FAF0EB",avC:"#C4613A"},
            {feat:false,stars:"★★★★★",q:"I was skeptical an algorithm could beat human judgment. The compatibility scores are genuinely impressive and the near-complete coverage is remarkable.",name:"Residential Affairs Director",role:"Large Engineering Institute · Pune",av:"RA",avBg:"#FBF5E6",avC:"#8A6A1A"},
          ].map(t=>(
            <div className={`tcard${t.feat?" tcard-feat":""}`} key={t.name}>
              <div className="tstars">{t.stars}</div>
              <div className="tquote">"{t.q}"</div>
              <div className="tauthor">
                <div className="tav" style={{background:t.avBg,color:t.avC}}>{t.av}</div>
                <div><div className="tname">{t.name}</div><div className="trole">{t.role}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ROADMAP */}
      <section className="rm-section" id="roadmap">
        <div className="eyebrow">Roadmap</div>
        <h2 className="sec-h2">Where we're going.<br/><em>Transparently.</em></h2>
        <p className="sec-sub">We build in the open. Here's exactly what's shipped, what's in progress, and what's coming — no vague promises.</p>
        <div className="rmlist">
          {ROADMAP_ITEMS.map(r=>(
            <div className="rm-item" key={r.title}>
              <div className={`rm-dot ${r.s}`}>{r.icon}</div>
              <div><div className={`rm-lbl ${r.s}`}>{r.lbl}</div><div className="rm-title">{r.title}</div><div className="rm-desc">{r.desc}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-bg"/>
        <div className="cta-in">
          <div className="cta-chip">🎓 Free for educational institutions · No credit card</div>
          <h2 className="cta-h2">Stop guessing.<br/>Start <em>matching.</em></h2>
          <p className="cta-sub">RoomSync is completely free for institutions during early access. Help us validate the model on your data — and give your students the compatible living situation they deserve.</p>
          <div className="cta-acts">
            <button className="btn-main" onClick={() => router.push("/register")}>Apply for free access →</button>
            <button className="btn-ghost" onClick={() => window.open("YOUR_PAPER_URL_HERE", "_blank")}>Read the research paper</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-grid">
          <div>
            <div className="footer-brand">RoomSync<div className="footer-brand-dot"/></div>
            <p className="footer-about">Compatibility-aware hostel allocation. Built on peer-reviewed research at Symbiosis Institute of Technology, Pune.</p>
          </div>
          <div className="fcol">
            <div className="fcol-head">Product</div>
            <a href="#">For Admins</a><a href="#">For Students</a><a href="#">How it works</a><a href="#">Roadmap</a>
          </div>
          <div className="fcol">
            <div className="fcol-head">Research</div>
            <a href="#">Read the paper</a><a href="#">Methodology</a><a href="#">Results</a><a href="#">Algorithm docs</a>
          </div>
          <div className="fcol">
            <div className="fcol-head">Company</div>
            <a href="#">About</a><a href="#">Contact</a><a href="#">Privacy</a><a href="#">Early access</a>
          </div>
        </div>
        <div className="footer-btm">
          <span>© 2025 RoomSync · Symbiosis Institute of Technology, Pune</span>
          <div className="res-badge">📄 Peer-reviewed research</div>
        </div>
      </footer>
    </>
  );
}