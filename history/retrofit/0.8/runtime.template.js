/* Temporary Connect 2 layout adapter for the inspected Connect 1 v74 framework. */
(function(w,d){
 'use strict';
 if(!d.body||w.__cmuLayout05||!w.framework){return;}
 var f=w.framework,style=d.createElement('style'),timer=null,elapsed=0,active=null,closed=false,backRecord=null;
 if(!f.getCurrentApp||!f.getCurrCtxtId){return;}
 var categories=new CmuSettingsCategories(w,d,f);
 w.__cmuLayout05=true;
 style.type='text/css';style.textContent="/* Temporary OEM skin 0.3. Visual properties only; stock layout and states remain authoritative. */\nbody.cmu-skin-05 .CommonBgImg{background-image:url(\"assets/7573352a258bc0ed8115b5c3317d1e46eb1dc918b85caf577f3e61c8b1b81c8c.png\") !important;background-color:#090909 !important;}\nbody.cmu-skin-05 .StatusBarCtrl{background-image:none !important;background-color:#111111 !important;color:#f7f7f7 !important;box-shadow:inset 0 -1px #333333 !important;}\nbody.cmu-skin-05 .MainMenuCtrlEllipse{background-image:none !important;}\nbody.cmu-skin-05 .MainMenuCtrlIconName{color:#f8f8f8 !important;text-shadow:none !important;}\nbody.cmu-skin-05 .MainMenuCtrlAppNormal{background-image:url(\"assets/568e3f039621d57ceb32a2bb12cfbcc060243b1293b3783fb8ea10faeacac72b.png\") !important;background-repeat:no-repeat !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .MainMenuCtrlAppFocus{background-image:url(\"assets/8420e5a787c6c21fddf7b3cd2c36b8eb2ebbd68a3917d1714514df633083e7b9.png\") !important;background-repeat:no-repeat !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .MainMenuCtrlAppHighlight{background-image:none !important;}\nbody.cmu-skin-05 .MainMenuCtrlEntNormal{background-image:url(\"assets/d2d6c5347ea0495d03919eb4315063ba9b9f8548a14a4fd2677bd6a5418c7fc8.png\") !important;background-repeat:no-repeat !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .MainMenuCtrlEntFocus{background-image:url(\"assets/67e6ff61b0085d53ddc580cf420d8de00f98166bcb448055bb22f762af20d269.png\") !important;background-repeat:no-repeat !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .MainMenuCtrlEntHighlight{background-image:none !important;}\nbody.cmu-skin-05 .MainMenuCtrlComNormal{background-image:url(\"assets/70fb322f1f0006a6ba278d21ca62a1b6bf8f3c05e868dc672e3b36e69caf9484.png\") !important;background-repeat:no-repeat !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .MainMenuCtrlComFocus{background-image:url(\"assets/d3d5d7edb92fff924b19d2816705a22e04e1631efac86f52c383bc8511647ab2.png\") !important;background-repeat:no-repeat !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .MainMenuCtrlComHighlight{background-image:none !important;}\nbody.cmu-skin-05 .MainMenuCtrlNavNormal{background-image:url(\"assets/dc6bd90aad008fd62b1d57ebd61fa5dad38ea35bd4a43bfaafa2b355d8628cec.png\") !important;background-repeat:no-repeat !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .MainMenuCtrlNavFocus{background-image:url(\"assets/57d4485f38158ea5151d2e4b6a86d760601ae57e2795e25a0d0b4900f359ee83.png\") !important;background-repeat:no-repeat !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .MainMenuCtrlNavHighlight{background-image:none !important;}\nbody.cmu-skin-05 .MainMenuCtrlSetNormal{background-image:url(\"assets/7ed160821e8cecb3933a8160210ade8186aed585d0d4ef639822c69c33358a35.png\") !important;background-repeat:no-repeat !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .MainMenuCtrlSetFocus{background-image:url(\"assets/1cb5ae6b9991277fc52500dc9e435269880124c3aba62814f9f4127cc50372c4.png\") !important;background-repeat:no-repeat !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .MainMenuCtrlSetHighlight{background-image:none !important;}\nbody.cmu-skin-05 .List2Ctrl{background-image:none !important;background-color:#101010 !important;border-radius:14px;}\nbody.cmu-skin-05 .List2CtrlActiveArea{background-image:none !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem{background-image:none !important;background-color:#141414 !important;box-shadow:inset 0 -1px #303030 !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.focus{background-color:#282828 !important;box-shadow:inset 3px 0 #eeeeee,inset 0 -1px #5b5b5b !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.hit,body.cmu-skin-05 .List2Ctrl .ListItem.hit.focus{background-color:#393939 !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.disabled{background-color:#111111 !important;box-shadow:inset 0 -1px #2b2b2b !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.disabled.focus{background-color:#292929 !important;}\nbody.cmu-skin-05 .ButtonCtrl{background-color:#242424 !important;color:#f0f0f0 !important;border-color:#555555 !important;border-radius:12px;}\nbody.cmu-skin-05 .ButtonCtrlFocused{background-color:#2e2e2e !important;border-color:#eeeeee !important;}\nbody.cmu-skin-05 .ButtonCtrlDown,body.cmu-skin-05 .ButtonCtrlHeld{background-color:#3b3b3b !important;}\nbody.cmu-skin-05 .ButtonCtrlDisabled{background-color:#191919 !important;color:#949494 !important;border-color:#353535 !important;}\nbody.cmu-skin-05 .TabsCtrlStyle2ButtonEnabled{background-image:none !important;background-color:#191919 !important;color:#bcbcbc !important;box-shadow:inset 0 -1px #414141 !important;}\nbody.cmu-skin-05 .TabsCtrlStyle2ButtonEnabledCurrent{background-image:none !important;background-color:#282828 !important;color:#ffffff !important;box-shadow:inset 0 -3px #eeeeee !important;}\nbody.cmu-skin-05 .TabsCtrlStyle2ButtonDown,body.cmu-skin-05 .TabsCtrlStyle2ButtonDownCurrent{background-image:none !important;background-color:#2b2b2b !important;}\nbody.cmu-skin-05 .TabsCtrlStyle2ButtonDisabled{color:#777777 !important;background-color:#141414 !important;}\nbody.cmu-skin-05 .TabsCtrlStyle3ButtonEnabled{background-image:none !important;background-color:#191919 !important;color:#bcbcbc !important;box-shadow:inset 0 -1px #414141 !important;}\nbody.cmu-skin-05 .TabsCtrlStyle3ButtonEnabledCurrent{background-image:none !important;background-color:#282828 !important;color:#ffffff !important;box-shadow:inset 0 -3px #eeeeee !important;}\nbody.cmu-skin-05 .TabsCtrlStyle3ButtonDown,body.cmu-skin-05 .TabsCtrlStyle3ButtonDownCurrent{background-image:none !important;background-color:#2b2b2b !important;}\nbody.cmu-skin-05 .TabsCtrlStyle3ButtonDisabled{color:#777777 !important;background-color:#141414 !important;}\nbody.cmu-skin-05 .TabsCtrlStyle4ButtonEnabled{background-image:none !important;background-color:#191919 !important;color:#bcbcbc !important;box-shadow:inset 0 -1px #414141 !important;}\nbody.cmu-skin-05 .TabsCtrlStyle4ButtonEnabledCurrent{background-image:none !important;background-color:#282828 !important;color:#ffffff !important;box-shadow:inset 0 -3px #eeeeee !important;}\nbody.cmu-skin-05 .TabsCtrlStyle4ButtonDown,body.cmu-skin-05 .TabsCtrlStyle4ButtonDownCurrent{background-image:none !important;background-color:#2b2b2b !important;}\nbody.cmu-skin-05 .TabsCtrlStyle4ButtonDisabled{color:#777777 !important;background-color:#141414 !important;}\nbody.cmu-skin-05 .TabsCtrlStyle4PrevBtn,body.cmu-skin-05 .TabsCtrlStyle4NextBtn,body.cmu-skin-05 .TabsCtrlStyle4PrevNextBtnHit{background-image:none !important;background-color:#191919 !important;}\nbody.cmu-skin-05 .TabsCtrlBottomMask{background-image:none !important;background-color:#101010 !important;}\nbody.cmu-skin-05 .ButtonCtrlIcon[style*=\"Tab_ArrowLeft.png\"]{background-image:url(\"assets/fe93fda9a396a90d293344f237eb849a4dfa755af20bb73f55d3f5b543e597b9.png\") !important;}\nbody.cmu-skin-05 .ButtonCtrlIcon[style*=\"Tab_ArrowLeft_Ds.png\"]{background-image:url(\"assets/2927eb0dd5eac4a5e07b16e85ce3b884a61ba06847b2ba5d4844904ea0071ae0.png\") !important;}\nbody.cmu-skin-05 .ButtonCtrlIcon[style*=\"Tab_ArrowRight.png\"]{background-image:url(\"assets/c9a9bc64fda5b2618aa1d0b088cbd0ffa75a6a275f9f5e28bb601b2b1c738fca.png\") !important;}\nbody.cmu-skin-05 .ButtonCtrlIcon[style*=\"Tab_ArrowRight_Ds.png\"]{background-image:url(\"assets/48613672b7e9e0252e15cad3cdaa10cb316a60d9e62dbd9d0b084eb7ff4e3d56.png\") !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.style10 .button{background-image:none !important;background-color:#252525 !important;color:#d4d4d4 !important;box-shadow:inset 0 -1px #555555 !important;text-shadow:none !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.style10 .button.active{background-color:#2f2f2f !important;color:#ffffff !important;box-shadow:inset 0 -3px #eeeeee !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.style10 .button.hit,body.cmu-skin-05 .List2Ctrl .ListItem.style10 .button.active.hit{background-color:#414141 !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.style10.disabled .button{background-color:#1b1b1b !important;color:#777777 !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.style10.disabled .button.active{box-shadow:inset 0 -2px #686868 !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.style11 .button{background-image:none !important;background-color:#252525 !important;color:#d4d4d4 !important;box-shadow:inset 0 -1px #555555 !important;text-shadow:none !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.style11 .button.active{background-color:#2f2f2f !important;color:#ffffff !important;box-shadow:inset 0 -3px #eeeeee !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.style11 .button.hit,body.cmu-skin-05 .List2Ctrl .ListItem.style11 .button.active.hit{background-color:#414141 !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.style11.disabled .button{background-color:#1b1b1b !important;color:#777777 !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.style11.disabled .button.active{box-shadow:inset 0 -2px #686868 !important;}\nbody.cmu-skin-05 .CommonRightChrome,body.cmu-skin-05 .LeftBtnCtrl_ChromeArc{background-image:none !important;background-color:#121212 !important;}\nbody.cmu-skin-05 .LeftBtnCtrlBackBtn{background-image:url(\"assets/ce26f8aa84e7bef327bc6cb585d9d55c30220d71bd54000bab90b54a531f4a28.png\") !important;}\nbody.cmu-skin-05 .LeftBtnCtrlBackBtnDisabled{background-image:url(\"assets/a2f53f90275f54dc0ac923b50ac33f7098bfdbeab61f4dffaae0690fe1234d88.png\") !important;}\nbody.cmu-skin-05 .LeftBtnCtrlBackBtnFocused{background-image:url(\"assets/f7b37c851ea9431137a605cf261145160885dd824149edf1fe79bc6a1a7c6f24.png\") !important;}\nbody.cmu-skin-05 .LeftBtnCtrlBackBtnDown{background-image:url(\"assets/f7b37c851ea9431137a605cf261145160885dd824149edf1fe79bc6a1a7c6f24.png\") !important;}\nbody.cmu-skin-05 .List2CtrlScrollIndicator{background-image:url(\"assets/9701c4b3d3495b690f4334a82b6160e711cf86c69d9de0d533402b00db504bff.png\") !important;background-repeat:repeat-y !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle01_En{background-image:none !important;background-color:#242424 !important;color:#eeeeee !important;box-shadow:inset 0 0 0 1px #555555 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle01_focused{background-image:none !important;background-color:#2e2e2e !important;color:#ffffff !important;box-shadow:inset 0 0 0 2px #eeeeee !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle01_down,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle01_held{background-image:none !important;background-color:#3b3b3b !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle01_Ds{background-image:none !important;background-color:#1b1b1b !important;color:#777777 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle02_En{background-image:none !important;background-color:#242424 !important;color:#eeeeee !important;box-shadow:inset 0 0 0 1px #555555 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle02_focused{background-image:none !important;background-color:#2e2e2e !important;color:#ffffff !important;box-shadow:inset 0 0 0 2px #eeeeee !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle02_down,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle02_held{background-image:none !important;background-color:#3b3b3b !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle02_Ds{background-image:none !important;background-color:#1b1b1b !important;color:#777777 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle03_En{background-image:none !important;background-color:#242424 !important;color:#eeeeee !important;box-shadow:inset 0 0 0 1px #555555 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle03_focused{background-image:none !important;background-color:#2e2e2e !important;color:#ffffff !important;box-shadow:inset 0 0 0 2px #eeeeee !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle03_down,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle03_held{background-image:none !important;background-color:#3b3b3b !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle03_Ds{background-image:none !important;background-color:#1b1b1b !important;color:#777777 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle04_En{background-image:none !important;background-color:#242424 !important;color:#eeeeee !important;box-shadow:inset 0 0 0 1px #555555 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle04_focused{background-image:none !important;background-color:#2e2e2e !important;color:#ffffff !important;box-shadow:inset 0 0 0 2px #eeeeee !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle04_down,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle04_held{background-image:none !important;background-color:#3b3b3b !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle04_Ds{background-image:none !important;background-color:#1b1b1b !important;color:#777777 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_BG_Style01{background-image:none !important;background-color:#171717 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_BG_Style02{background-image:none !important;background-color:#171717 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl,body.cmu-skin-05 .Dialog3CtrlFs{background-image:none !important;background-color:#171717 !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlIconName{opacity:0 !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlCoinFocus{-o-transform:none !important;transform:none !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlCoinAExplode,body.cmu-layout-home-05 .MainMenuCtrlCoinBExplode,body.cmu-layout-home-05 .MainMenuCtrlHighlightExplode{animation-name:none !important;}\nbody.cmu-layout-home-05 .MainMenuCtrl{background-image:url(\"assets/b85c98e96dc1351976d0001a0aad1743326bbaeb99876e4091596b204fd5c49c.png\") !important;}\nbody.cmu-layout-home-05 .StatusBarCtrl{background-color:#090909 !important;box-shadow:none !important;}\nbody.cmu-layout-home-05 .cmu-layout-label{position:absolute;left:74px;top:0;height:62px;line-height:62px;font-size:28px;color:#bbbbbb;white-space:nowrap;}\nbody.cmu-layout-home-05 .MainMenuCtrlCoinFocus .cmu-layout-label{font-size:30px;color:#ffffff;}\nbody.cmu-layout-home-05 .MainMenuCtrlAppDiv{left:130px !important;top:32px !important;width:440px !important;height:62px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlAppNormal{width:440px !important;height:62px !important;background-image:url(\"assets/97887f1bfa5c779890e6718fd0ccc2eb5a9b2f5dbb00c54352b4d13c9031c6ee.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlAppFocus{width:440px !important;height:62px !important;background-image:url(\"assets/6ef0c2bc16473be755c387fc78aa65013bbbe9dd5169c671ee8eb513ce63dd81.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlAppFocus{opacity:0 !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlCoinFocus .MainMenuCtrlAppFocus{opacity:1 !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlEntDiv{left:100px !important;top:100px !important;width:440px !important;height:62px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlEntNormal{width:440px !important;height:62px !important;background-image:url(\"assets/a41f387b427c302db14714262c0e223cc4dd57977352763939b2727e343a13ea.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlEntFocus{width:440px !important;height:62px !important;background-image:url(\"assets/53e992913221243ad3f25395861c75a5282eac467c7ffe874288506aa00284bb.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlEntFocus{opacity:0 !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlCoinFocus .MainMenuCtrlEntFocus{opacity:1 !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlComDiv{left:90px !important;top:168px !important;width:440px !important;height:62px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlComNormal{width:440px !important;height:62px !important;background-image:url(\"assets/25b2b6a4cf9f5b276e0bc2cc7b117a2030eb2ef239823b0f771174947df410c2.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlComFocus{width:440px !important;height:62px !important;background-image:url(\"assets/842c7a53dd666ed56f78fc4dcb3be148043ab9f1903dab3277bbd2f9a666834d.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlComFocus{opacity:0 !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlCoinFocus .MainMenuCtrlComFocus{opacity:1 !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlNavDiv{left:100px !important;top:236px !important;width:440px !important;height:62px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlNavNormal{width:440px !important;height:62px !important;background-image:url(\"assets/76a2fdd220be34dac23318163d01549c9fb38c19a94e242102d825b343fe350b.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlNavFocus{width:440px !important;height:62px !important;background-image:url(\"assets/e552e4541155e8d1b5f2f75aaa2225fc865c8bc73209e7eb945e3bcc110a73b5.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlNavFocus{opacity:0 !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlCoinFocus .MainMenuCtrlNavFocus{opacity:1 !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlSetDiv{left:130px !important;top:304px !important;width:440px !important;height:62px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlSetNormal{width:440px !important;height:62px !important;background-image:url(\"assets/f17454c76270bde66b264da304b23511eef811fb9b2b3f6e4d0ed987782eb8ba.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlSetFocus{width:440px !important;height:62px !important;background-image:url(\"assets/f1d5b434d55176485e15f918b849a9c5224a8a785607505132c4c5738df43a79.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlSetFocus{opacity:0 !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlCoinFocus .MainMenuCtrlSetFocus{opacity:1 !important;}\nbody.cmu-layout-home-05 .cmu-layout-clock{position:absolute;left:586px;top:125px;width:160px;height:160px;}\nbody.cmu-layout-home-05 .cmu-layout-clock-canvas{width:160px;height:160px;}\nbody.cmu-layout-list-05 .StatusBarCtrl{background-color:#090909 !important;box-shadow:none !important;}\nbody.cmu-layout-list-05 .StatusBarCtrlAppName{font-size:30px !important;}\nbody.cmu-layout-list-05 .List2Ctrl,body.cmu-layout-list-05 .List2Ctrl .ListItem{background-color:#090909 !important;box-shadow:none !important;border-radius:0 !important;}\nbody.cmu-layout-list-05 .List2Ctrl .ListItem.focus{background-color:#191919 !important;box-shadow:inset 0 1px #aaaaaa,inset 0 -1px #888888 !important;}\nbody.cmu-layout-list-05 .List2Ctrl .ListItem.hit,body.cmu-layout-list-05 .List2Ctrl .ListItem.hit.focus{background-color:#292929 !important;}\nbody.cmu-layout-list-05 .List2Ctrl .ListItem.disabled{background-color:#090909 !important;}\nbody.cmu-layout-list-05 .List2Ctrl .ListItem.disabled.focus{background-color:#181818 !important;box-shadow:inset 0 1px #666666,inset 0 -1px #444444 !important;}\nbody.cmu-layout-list-05 .List2Ctrl .ListItem .line1{font-size:30px !important;}\nbody.cmu-skin-05 .StatusBarCtrlAppName,body.cmu-skin-05 .StatusBarCtrlClock,body.cmu-skin-05 .List2Ctrl .line1,body.cmu-skin-05 .List2Ctrl .line2,body.cmu-skin-05 .List2Ctrl .label1,body.cmu-skin-05 .List2Ctrl .label2{text-shadow:none !important;}\nbody.cmu-skin-05 .ButtonCtrl{border-radius:3px !important;}\nbody.cmu-skin-05 .CommonBgImg{background-image:url(\"assets/a39e62035485d7ee75c60e9d4ebd95358bc5ed4a6335c0cdb5da375eef1936e2.png\") !important;background-color:#080808 !important;}\nbody.cmu-skin-05 .LeftBtnCtrlBackBtn,body.cmu-skin-05 .LeftBtnCtrlBackBtnDisabled,body.cmu-skin-05 .LeftBtnCtrlBackBtnFocused,body.cmu-skin-05 .LeftBtnCtrlBackBtnDown{display:none !important;}\nbody.cmu-skin-05 .LeftBtnCtrl_ChromeArc,body.cmu-skin-05 .CommonRightChrome{display:none !important;}\nbody.cmu-skin-05 .List2CtrlScrollIndicatorWrapper{background-image:none !important;background-color:#171717 !important;}\nbody.cmu-skin-05 .List2CtrlScrollIndicator{background-image:url(\"assets/a7544b054766811ed717f9faa2be460091f24171d5126105f0b965279006c96c.png\") !important;background-repeat:repeat-y !important;background-position:0 0 !important;}\nbody.cmu-skin-05 .List2Ctrl,body.cmu-skin-05 .List2Ctrl .ListItem{border-radius:0 !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.focus{background-color:#202020 !important;box-shadow:inset 0 1px #bbbbbb,inset 0 -1px #bbbbbb !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.hit,body.cmu-skin-05 .List2Ctrl .ListItem.hit.focus{background-color:#333333 !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.disabled.focus{background-color:#171717 !important;box-shadow:inset 0 1px #666666,inset 0 -1px #666666 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle01_Red_En,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle01_Green_En{background-image:none !important;background-color:#242424 !important;color:#eeeeee !important;box-shadow:inset 0 0 0 1px #777777 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle02_Red_En,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle02_Green_En{background-image:none !important;background-color:#242424 !important;color:#eeeeee !important;box-shadow:inset 0 0 0 1px #777777 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle03_Red_En,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle03_Green_En{background-image:none !important;background-color:#242424 !important;color:#eeeeee !important;box-shadow:inset 0 0 0 1px #777777 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle04_Red_En,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle04_Green_En{background-image:none !important;background-color:#242424 !important;color:#eeeeee !important;box-shadow:inset 0 0 0 1px #777777 !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.checkbox .image1{background-image:url(\"assets/5c9004c25de2ba8571270a633a62caf9e6a52fbf40a2deb14228ddea2e364a72.png\") !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.checkbox.disabled .image1{background-image:url(\"assets/9fc00b8502693f8058ba8434efecf72c27962b565b363716384b2a19980a3886.png\") !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.checkbox.checked .image1{background-image:url(\"assets/bbc9da2e6e1df159c18d27df567f1399543207b659ffd76898d0b716c2dcf8e3.png\") !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.checkbox.checked.disabled .image1{background-image:url(\"assets/673108182ed4299da24ca0d5c3a5034f205cc1063bd2cd7671f95bd8a4c4a945.png\") !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.radio .image1{background-image:url(\"assets/298bb807871a444435c4b0ae2accaa5da137ca91519f60be990dd9083c7cb015.png\") !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.radio.disabled .image1{background-image:url(\"assets/94432e647a90330b38112f893ee2000b9e6c94d5576d19e86859173efa2e9bc1.png\") !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.radio.checked .image1{background-image:url(\"assets/9b44ad6186ed4d1197c12a3d767569b2fe0e68cd189f3c8cda58c1c05616a7b9.png\") !important;}\nbody.cmu-skin-05 .List2Ctrl .ListItem.radio.checked.disabled .image1{background-image:url(\"assets/599ffe20e87754d93bb6cce2d6e7f51fd179edec72867bb359355afd773880f4.png\") !important;}\nbody.cmu-skin-05 .List2CtrlSliderCtrl{background-image:url(\"assets/739f0a3902a8209fafb894900bb6a46b47ee37e1ef246aa06d1759e7cb57ba89.png\") !important;background-repeat:repeat-x !important;}\nbody.cmu-skin-05 .List2CtrlSliderCtrlFill,body.cmu-skin-05 .List2CtrlSliderCtrlFocusedFill{background-image:url(\"assets/53280f84d6a49e0ec098d4d19ccb5a356a6b7ac157eabc71cedf9b9862c592aa.png\") !important;background-repeat:repeat-x !important;}\nbody.cmu-skin-05 .List2CtrlSliderCtrlHandle{background-image:url(\"assets/2d409f7b46041623b69d89409f5d1b3cce09b87651e0fe57639929fef81fb292.png\") !important;}\nbody.cmu-skin-05 .List2CtrlSliderCtrlFocusedHandle{background-image:url(\"assets/26bd5d5f6dbee7499e813cac0a3f416e0fd53cb49acdb7c0093bff1beef280cf.png\") !important;}\n\n/* 0.5.2: genuine OEM row assets, only color channels changed. */\nbody.cmu-skin-05 .List2Ctrl .ListItem.focus,body.cmu-skin-05 .List2Ctrl .ListItem.hit,body.cmu-skin-05 .List2Ctrl .ListItem.longpress,body.cmu-skin-05 .List2Ctrl .ListItem.secondaryFocus,body.cmu-skin-05 .List2Ctrl .ListItem.bgGrey,body.cmu-skin-05 .List2Ctrl .ListItem.bgLightGrey{box-shadow:none !important;background-color:transparent !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.bgGrey{background-image: url(\"assets/038bfe8f7706a477d8b98feff09d2460702a127ef97e48cc37c19f2942d785d2.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.bgLightGrey{background-image: url(\"assets/cc77d3ef21e3a9f6a34a540d3f5333b2ca5d9f4cade4e6323d12d99225601f25.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.hit{background-image: url(\"assets/f650ca4795da516c4b79a0d613c13d500a0ab2571d4f90c68931b8469a44e71d.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.focus{background-image: url(\"assets/bebbfa27468b36b6a587d8bca2a2a2829db2dbb901da03716e2761ebeb933151.png\"), url(\"assets/dd20e7ee576cffa8d3cda3e2ca38d29866dca26b9e24c3a746f3d650ad99a455.png\") !important;background-position: 0 100%, 0 100% !important;background-repeat: no-repeat, repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.bgGrey.disabled{background-image: url(\"assets/038bfe8f7706a477d8b98feff09d2460702a127ef97e48cc37c19f2942d785d2.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.bgLightGrey.disabled{background-image: url(\"assets/cc77d3ef21e3a9f6a34a540d3f5333b2ca5d9f4cade4e6323d12d99225601f25.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.disabled.focus{background-image: url(\"assets/dd20e7ee576cffa8d3cda3e2ca38d29866dca26b9e24c3a746f3d650ad99a455.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.longpress.longpress.longpress{background-image: url(\"assets/038bfe8f7706a477d8b98feff09d2460702a127ef97e48cc37c19f2942d785d2.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.hit.focus{background-image: url(\"assets/f650ca4795da516c4b79a0d613c13d500a0ab2571d4f90c68931b8469a44e71d.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.secondaryFocus.secondaryFocus.secondaryFocus{background-image: url(\"assets/bebbfa27468b36b6a587d8bca2a2a2829db2dbb901da03716e2761ebeb933151.png\") !important;background-position: 0 100% !important;background-repeat: no-repeat !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.bgGrey{background-image: url(\"assets/36e8c962880bb10b4244118a0e24b03ee09b380fbe3545029b1549a2ffaa9c39.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.bgLightGrey{background-image: url(\"assets/37fd6e0713af9e5c44c81bbe28a35356226b02a8d07b5b8159c012726be448cb.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.hit{background-image: url(\"assets/09c234ae83e36431d9675a92e907c8545d0eb718d7013f3aac6311c1ddd2548c.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.focus{background-image: url(\"assets/bebbfa27468b36b6a587d8bca2a2a2829db2dbb901da03716e2761ebeb933151.png\"), url(\"assets/9968b8dec590ae18869fddfd643036b68f0b5792393aad65282202a8b917b902.png\") !important;background-position: 0 100%, 0 100% !important;background-repeat: no-repeat, repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.bgGrey.disabled{background-image: url(\"assets/36e8c962880bb10b4244118a0e24b03ee09b380fbe3545029b1549a2ffaa9c39.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.bgLightGrey.disabled{background-image: url(\"assets/37fd6e0713af9e5c44c81bbe28a35356226b02a8d07b5b8159c012726be448cb.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.disabled.focus{background-image: url(\"assets/9968b8dec590ae18869fddfd643036b68f0b5792393aad65282202a8b917b902.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.longpress.longpress.longpress{background-image: url(\"assets/36e8c962880bb10b4244118a0e24b03ee09b380fbe3545029b1549a2ffaa9c39.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.hit.focus{background-image: url(\"assets/09c234ae83e36431d9675a92e907c8545d0eb718d7013f3aac6311c1ddd2548c.png\") !important;background-position: 0 100% !important;background-repeat: repeat-y !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.secondaryFocus.secondaryFocus.secondaryFocus{background-image: url(\"assets/bebbfa27468b36b6a587d8bca2a2a2829db2dbb901da03716e2761ebeb933151.png\") !important;background-position: 0 100% !important;background-repeat: no-repeat !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlAppFocus{background-image:url(\"assets/55388b370c8f802864fa7accfd3632fef1bbc5c404a62e9c820900f99d308e4e.png\"),url(\"assets/23c87b53e87ec4201567b840d2f89347db4f101a3bdec31412c6a03084cd3041.png\") !important;background-position:0 0,0 0 !important;background-repeat:no-repeat,no-repeat !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlEntFocus{background-image:url(\"assets/3e4b66b019d351efeb854898d475d335f11ded0586dcdf37278515df98222d2f.png\"),url(\"assets/23c87b53e87ec4201567b840d2f89347db4f101a3bdec31412c6a03084cd3041.png\") !important;background-position:0 0,0 0 !important;background-repeat:no-repeat,no-repeat !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlComFocus{background-image:url(\"assets/d64ea7c703c5d1b000e45f4aa522bd80e06cdcabff7cec763768a61cca5b5fc2.png\"),url(\"assets/23c87b53e87ec4201567b840d2f89347db4f101a3bdec31412c6a03084cd3041.png\") !important;background-position:0 0,0 0 !important;background-repeat:no-repeat,no-repeat !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlNavFocus{background-image:url(\"assets/f3ff07099a7c5656f14c05c724bb0d894e630ea99cb170ed30c58865efc025f3.png\"),url(\"assets/23c87b53e87ec4201567b840d2f89347db4f101a3bdec31412c6a03084cd3041.png\") !important;background-position:0 0,0 0 !important;background-repeat:no-repeat,no-repeat !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlSetFocus{background-image:url(\"assets/dbacd6ccd9d137450c231e0cea3dabda1efaa5c17968b127762ccc71194bf36c.png\"),url(\"assets/23c87b53e87ec4201567b840d2f89347db4f101a3bdec31412c6a03084cd3041.png\") !important;background-position:0 0,0 0 !important;background-repeat:no-repeat,no-repeat !important;}\n\n/* 0.5.3: commander background; home selection by size only. OEM list selection retained. */\nbody.cmu-skin-05 .CommonBgImg{background-image:url(\"assets/e7a441cda6a9a35bfafd01373a771c0bb19102f353321b6f36eb7bf1bccd62fd.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrl{background-image:none !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlCoinFocus .cmu-layout-label{font-size:34px !important;color:#ffffff !important;}\nbody.cmu-skin-05 .List2Ctrl,body.cmu-skin-05 .List2Ctrl .ListItem{background-color:transparent !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlAppFocus{background-image:url(\"assets/61386105214eb6d9f9ba1a54e65f6c0a343b016ce5459bd548cd9898e8b06499.png\") !important;background-position:0 0 !important;background-repeat:no-repeat !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlEntFocus{background-image:url(\"assets/57b68bd91ace60898dd4e2de85cff438511aeace75831416695aeb50eff482b9.png\") !important;background-position:0 0 !important;background-repeat:no-repeat !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlComFocus{background-image:url(\"assets/a61c922f6a0b4a40d26ae7c127af70b6977472d451eba1e2c595270b0a4f8725.png\") !important;background-position:0 0 !important;background-repeat:no-repeat !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlNavFocus{background-image:url(\"assets/98f53b58916056551e4e7dceac40514f2fd2df02aeb519662f912fa01632def5.png\") !important;background-position:0 0 !important;background-repeat:no-repeat !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlSetFocus{background-image:url(\"assets/2f65f8316012f79925abfc831ff6577df921f2185d64b110b9683fa4449bc6a7.png\") !important;background-position:0 0 !important;background-repeat:no-repeat !important;}\n\n/* 0.6: Connect 2 reference adaptation, scoped to eligible native web apps. */\n@font-face{font-family:\"CmuRetrofit\";src:url(\"assets/4644c81b86ec9caaa76b634889968ed3c4f4f52f054855933acc7c2b21e53b0f.ttf\") format(\"truetype\");font-style:normal;font-weight:400;}\nbody.cmu-skin-05 .List2Ctrl,body.cmu-skin-05 .ButtonCtrl,body.cmu-skin-05 .ButtonCtrlCheckBoxLabel,body.cmu-skin-05 .StatusBarCtrl,body.cmu-skin-05 .Dialog3Ctrl,body.cmu-skin-05 .Dialog3CtrlFs,body.cmu-skin-05 .KeyboardCtrl,body.cmu-skin-05 .NowPlaying4Ctrl,body.cmu-skin-05 .Tuner4Ctrl,body.cmu-skin-05 .cmu-layout-label{font-family:\"CmuRetrofit\",\"Tipperary\",Arial,sans-serif !important;font-weight:normal !important;}\nbody.cmu-skin-05 .CommonBgImg{background-image:url(\"assets/2ee8dcb3d7ff44ee9184d6b5567c2a921389ef0bdad9c82a1d5241a416f71b98.png\") !important;background-color:#090909 !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem{background-color:transparent !important;box-shadow:none !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.focus.focus.focus.focus,body.cmu-skin-05 .List2Ctrl.normalItems .ListItem.hit.hit.hit.hit,body.cmu-skin-05 .List2Ctrl.normalItems .ListItem.hit.focus.hit.focus.hit.focus.hit.focus,body.cmu-skin-05 .List2Ctrl.normalItems .ListItem.secondaryFocus.secondaryFocus.secondaryFocus.secondaryFocus,body.cmu-skin-05 .List2Ctrl.normalItems .ListItem.longpress.longpress.longpress.longpress{background-image:url(\"assets/2ad7f7482f4b22d485e89a10a7fb7332410be7bcac9107f28ef0dfbf2c91a9a5.png\") !important;background-size:100% 100% !important;background-repeat:no-repeat !important;background-color:transparent !important;animation:none !important;-o-animation:none !important;}\nbody.cmu-skin-05 .List2Ctrl.normalItems .ListItem.disabled.focus{opacity:.55 !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem{background-color:transparent !important;box-shadow:none !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.focus.focus.focus.focus,body.cmu-skin-05 .List2Ctrl.thickItems .ListItem.hit.hit.hit.hit,body.cmu-skin-05 .List2Ctrl.thickItems .ListItem.hit.focus.hit.focus.hit.focus.hit.focus,body.cmu-skin-05 .List2Ctrl.thickItems .ListItem.secondaryFocus.secondaryFocus.secondaryFocus.secondaryFocus,body.cmu-skin-05 .List2Ctrl.thickItems .ListItem.longpress.longpress.longpress.longpress{background-image:url(\"assets/9e3fc3ab3de13e0103f0d03d6504a631f54dfca53effa379b8a8ac45cf97c925.png\") !important;background-size:100% 100% !important;background-repeat:no-repeat !important;background-color:transparent !important;animation:none !important;-o-animation:none !important;}\nbody.cmu-skin-05 .List2Ctrl.thickItems .ListItem.disabled.focus{opacity:.55 !important;}\nbody.cmu-skin-05 .List2Ctrl .line1{font-size:30px !important;text-shadow:none !important;}\nbody.cmu-skin-05 .List2Ctrl .line2,body.cmu-skin-05 .List2Ctrl .label1,body.cmu-skin-05 .List2Ctrl .label2{text-shadow:none !important;}\nbody.cmu-skin-05 .List2CtrlTitle .line1{font-size:30px !important;text-shadow:none !important;}\nbody.cmu-skin-05 .List2CtrlScrollIndicatorWrapper{background-color:transparent !important;}\nbody.cmu-skin-05 .List2CtrlScrollIndicator{background-image:none !important;background-color:#eeeeee !important;}\nbody.cmu-skin-05 .List2CtrlSliderCtrlFill,body.cmu-skin-05 .List2CtrlSliderCtrlFocusedFill{background-image:none !important;background-color:#eeeeee !important;}\nbody.cmu-skin-05 .KeyboardCtrl{background-image:none !important;background-color:#101010 !important;}\nbody.cmu-skin-05 .KeyboardCtrl .btnWrapper .btn{background-image:none !important;background-color:#181818 !important;box-shadow:inset 0 -1px #555555 !important;}\nbody.cmu-skin-05 .KeyboardCtrl .btnWrapper .btn.focused,body.cmu-skin-05 .KeyboardCtrl .btnWrapper .btn.activeState{background-image:url(\"assets/2ad7f7482f4b22d485e89a10a7fb7332410be7bcac9107f28ef0dfbf2c91a9a5.png\") !important;background-size:100% 100% !important;color:#ffffff !important;}\nbody.cmu-skin-05 .KeyboardCtrl .btnWrapper .btn.disabled{color:#777777 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl,body.cmu-skin-05 .Dialog3CtrlFs{background-image:none !important;background-color:#101010 !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle01_focused,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle01_down,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle01_held{background-image:url(\"assets/2ad7f7482f4b22d485e89a10a7fb7332410be7bcac9107f28ef0dfbf2c91a9a5.png\") !important;background-size:100% 100% !important;background-color:#101010 !important;box-shadow:none !important;}\nbody.cmu-skin-05 .Dialog3Ctrl_ButtonStyle02_focused,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle02_down,body.cmu-skin-05 .Dialog3Ctrl_ButtonStyle02_held{background-image:url(\"assets/2ad7f7482f4b22d485e89a10a7fb7332410be7bcac9107f28ef0dfbf2c91a9a5.png\") !important;background-size:100% 100% !important;background-color:#101010 !important;box-shadow:none !important;}\nbody.cmu-skin-05 .StatusBarCtrl{background-image:none !important;background-color:transparent !important;box-shadow:inset 0 -1px #555555 !important;}\nbody.cmu-skin-05 .StatusBarCtrlAppName{font-size:30px !important;text-shadow:none !important;}\nbody.cmu-skin-05 .StatusBarCtrlClock{font-size:25px !important;text-shadow:none !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlAppDiv{left:100px !important;top:11px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlEntDiv{left:80px !important;top:79px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlComDiv{left:70px !important;top:147px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlNavDiv{left:80px !important;top:215px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlSetDiv{left:100px !important;top:283px !important;}\nbody.cmu-layout-home-05 .cmu-layout-clock{left:564px;top:98px;width:156px;height:156px;}\nbody.cmu-layout-home-05 .cmu-layout-clock-canvas{width:156px;height:156px;}\n\nbody.cmu-layout-home-05 .MainMenuCtrlAppNormal{background-image:url(\"assets/0aa44c276b294eaea43f4cd5abaa47169a0ad5a19ffe3fb64703396f0016b516.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlAppFocus{background-image:url(\"assets/aa303dd0d455e38756e182de3ac853dbeff32191d133fef90418f723674ae11b.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlEntNormal{background-image:url(\"assets/d0af0101031daf417d4cadfeedca4c446b39d1c5fe99b9a445fc2969d4824fa0.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlEntFocus{background-image:url(\"assets/863e8e9c30ceaa34523f6ad92da103f6be03aa6db1d92d420ea769a0c7430e69.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlComNormal{background-image:url(\"assets/0dfb6d047471219173878b73d4ed9c889a468f56e1e0c177167275f90ab22ce6.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlComFocus{background-image:url(\"assets/2c642ddec61fc134e12a7ee044c7cc07e881a403cbda0d424632f5c086f4b5f6.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlNavNormal{background-image:url(\"assets/e7df212e0ef7f83b74aa7501feb337fa3691764d324d27501e660ce9e4cd2895.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlNavFocus{background-image:url(\"assets/8fdb213fe19450cfb7edbf0d3c9f9a6dbddcb4d13eb088c8a4e5a359eee7b730.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlSetNormal{background-image:url(\"assets/43dc38e3ebc5bac25d6a91eb51a48b3757125bd07b236416a92e5f0ebc0e5a41.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlSetFocus{background-image:url(\"assets/4c52b70d2d81532822b3555e21d73e5a1ebdd100229e44fc714541f5ec9b9855.png\") !important;}\nbody.cmu-layout-home-05 .MainMenuCtrl{top:-64px !important;height:480px !important;background-image:none !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlAppDiv{left:119px !important;top:46px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlEntDiv{left:119px !important;top:126px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlComDiv{left:119px !important;top:206px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlNavDiv{left:119px !important;top:286px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlSetDiv{left:119px !important;top:366px !important;}\nbody.cmu-layout-home-05 .MainMenuCtrlCoinFocus .cmu-layout-label{font-size:34px !important;}\nbody.cmu-layout-home-05 .cmu-layout-clock{left:564px;top:162px;width:156px;height:156px;}\nbody.cmu-layout-home-05 .StatusBarCtrl{pointer-events:none;background-color:transparent !important;}\nbody.cmu-layout-home-05 .StatusBarCtrlClockBtn,body.cmu-layout-home-05 .StatusBarCtrlRemoteUIBtn_En,body.cmu-layout-home-05 .StatusBarCtrlHomeBtn{pointer-events:auto;}\nbody.cmu-layout-home-05 .StatusBarCtrlAppName,body.cmu-layout-home-05 .StatusBarCtrlDomainIcon,body.cmu-layout-home-05 .StatusBarCtrlDivider{visibility:hidden !important;}\nbody.cmu-skin-05 .CommonBgImg{background-image:url(\"assets/fa8539d23f18c6c3b53c0b3e1baf25caba6eab25e5039e0bdb9362717ba4caab.png\") !important;}\n.cmu-next-arc-scroll{position:absolute;left:676px;top:62px;width:108px;height:356px;pointer-events:none;z-index:8;}\nbody.cmu-skin-05 .cmu-next-arc-scroll-owned{visibility:hidden !important;}\n/* 0.8: native, equipment-driven settings categories. */\nbody.cmu-settings-adapted .StatusBarCtrlAppName{visibility:hidden !important;}\n.cmu-settings-native-tabs,.cmu-settings-covered{visibility:hidden !important;}\n.cmu-settings-categories{position:absolute;left:40px;top:72px;width:700px;height:390px;z-index:12;font-family:\"CmuRetrofit\",\"Tipperary\",Arial,sans-serif;}\n.cmu-settings-categories-heading{position:absolute;left:0;top:0;width:700px;height:48px;line-height:44px;font-size:30px;color:#eeeeee;border-bottom:1px solid #777777;}\n.cmu-settings-category-row{position:absolute;left:0;width:700px;height:54px;line-height:54px;padding:0 18px;text-align:left;white-space:nowrap;border:0;border-radius:0;background:transparent;color:#eeeeee;font-family:\"CmuRetrofit\",\"Tipperary\",Arial,sans-serif;font-size:30px;box-sizing:border-box;}\n.cmu-settings-category-row:disabled{color:#777777;}\n.cmu-settings-category-current{background-image:url(\"assets/2ad7f7482f4b22d485e89a10a7fb7332410be7bcac9107f28ef0dfbf2c91a9a5.png\");background-repeat:no-repeat;background-size:100% 100%;}\n.cmu-settings-content-heading{position:absolute;left:0;top:10px;width:700px;height:44px;line-height:44px;font-size:30px;color:#eeeeee;font-family:\"CmuRetrofit\",\"Tipperary\",Arial,sans-serif;}\n.cmu-settings-category-scroll-marker{position:absolute;width:0;height:0;}\n";d.head.appendChild(style);
 function removeClass(name){d.body.className=(d.body.className||'').replace(new RegExp('(?:^|\\s)'+name+'(?=\\s|$)','g'),'').replace(/^\s+|\s+$/g,'');}
 function unmark(){removeClass('cmu-skin-05');removeClass('cmu-layout-home-05');removeClass('cmu-layout-list-05');}
 function mark(name){d.body.className+=(d.body.className?' ':'')+name;}
 function add(tag,cls,parent){var x=d.createElement(tag);x.className=cls;parent.appendChild(x);return x;}
 function restoreBack(){
  if(backRecord){backRecord.properties.leftButtonVisible=backRecord.value;backRecord=null;}
 }
 function syncBack(enabled){
  var common=f.common,left=common&&common.leftBtn,t=common&&common._cachedTemplate;
  var eligible=enabled&&left&&left.getStyle&&left.getStyle()==='goBack'&&t&&t.properties;
  if(backRecord&&(!eligible||backRecord.template!==t)){restoreBack();}
  if(eligible&&!backRecord){
   backRecord={template:t,properties:t.properties,value:t.properties.leftButtonVisible};
   t.properties.leftButtonVisible=false;
   if(left.btnInstance&&left.btnInstance.hasFocus&&left.handleControllerEvent&&t.handleControllerEvent){
    left.handleControllerEvent('lostFocus');t.handleControllerEvent('acceptFocusFromLeft');
   }
  }
 }
 function detach(){
  if(!active){return;}
  var a=active,c=a.control,i,k;
  for(k in a.methods){if(Object.prototype.hasOwnProperty.call(a.methods,k)){
   if(a.methods[k].own){c[k]=a.methods[k].value;}else{delete c[k];}
  }}
  for(i=0;i<a.coins.length;i++){
   c._coins[i].normalHitArea=a.coins[i].normal;
   c._coins[i].focusHitArea=a.coins[i].focus;
   c._coins[i].currentHitArea=c._coins[i].hasFocus?a.coins[i].focus:a.coins[i].normal;
   if(a.labels[i]&&a.labels[i].parentNode){a.labels[i].parentNode.removeChild(a.labels[i]);}
  }
  if(a.clock.parentNode){a.clock.parentNode.removeChild(a.clock);}
  c._fullyHighlightedIndex=c._getFocus();
  active=null;
 }
 function attach(c){
  if(!c||!c._coins||c._coins.length!==5||!c._hitTestHelper||!c._setHighlight||!c.handleControllerEvent||!c.divElt||typeof c._pendingInvokeSelectIndex==='number'){return false;}
  var a={control:c,methods:{},coins:[],labels:[],clock:null,full:c._fullyHighlightedIndex},i;
  var names=['_hitTestHelper','_setHighlight','handleControllerEvent','_invokeSelectCallback'];
  for(i=0;i<names.length;i++){a.methods[names[i]]={own:Object.prototype.hasOwnProperty.call(c,names[i]),value:c[names[i]]};}
  // Save every old area before the first mutation, allowing partial setup to be undone.
  var keys=['App','Ent','Com','Nav','Set'];
  for(i=0;i<5;i++){if(c._coins[i].key!==keys[i]||!c._coins[i].div||!c._coins[i].div.getBoundingClientRect){return false;}}
  for(i=0;i<5;i++){a.coins.push({normal:c._coins[i].normalHitArea,focus:c._coins[i].focusHitArea});}
  a.clock=add('div','cmu-layout-clock',c.divElt);a.clock.style.display='none';
  a.canvas=add('canvas','cmu-layout-clock-canvas',a.clock);a.canvas.width=640;a.canvas.height=640;
  try{a.ctx=a.canvas.getContext?a.canvas.getContext('2d'):null;}catch(canvasUnavailable){a.ctx=null;}
  a.clockKey=null;
  active=a;
  for(i=0;i<5;i++){
   var coin=c._coins[i],label=add('span','cmu-layout-label',coin.div);
   a.labels.push(label);
   label.textContent=f.localize.getLocStr(c.uiaId,coin.nameId);
   var area={cmuLayoutNode:coin.div};coin.normalHitArea=area;coin.focusHitArea=area;coin.currentHitArea=area;
  }
  c._hitTestHelper=function(x,y,area){
   if(area&&area.cmuLayoutNode){var r=area.cmuLayoutNode.getBoundingClientRect(),sx=w.pageXOffset||0,sy=w.pageYOffset||0;return x>=r.left+sx&&x<r.right+sx&&y>=r.top+sy&&y<r.bottom+sy;}
   return a.methods._hitTestHelper.value.call(this,x,y,area);
  };
  c._setHighlight=function(index){
   var result=a.methods._setHighlight.value.call(this,index);
   // The new rows do not use the OEM coin expansion transition; selection must not wait for it.
   this._fullyHighlightedIndex=index>=0&&index<5?index:null;
   return result;
  };
  c.handleControllerEvent=function(eventId){
   var mapped={upStart:'leftStart',up:'left',downStart:'rightStart',down:'right'};
   return a.methods.handleControllerEvent.value.call(this,mapped[eventId]||eventId);
  };
  c._invokeSelectCallback=function(index){
   if(index===this._fullyHighlightedIndex&&typeof this.properties.selectCallback==='function'){
    if(index===4){try{categories.armFromHome(f.localize.getLocStr(this.uiaId,this._coins[index].nameId),elapsed);}catch(labelFailure){categories.cancelPending();}}
    else{categories.cancelPending();}
   }
   try{return a.methods._invokeSelectCallback.value.call(this,index);}
   catch(selectFailure){categories.cancelPending();throw selectFailure;}
  };
  c._setHighlight(c._getFocus());
  return true;
 }
 function clock(){
  if(!active){return;}
  var source=d.querySelector('.StatusBarCtrlClock'),m=source&&/(\d{1,2})\s*:\s*(\d{2})/.exec(source.textContent||'');
  if(!m||Number(m[1])>23||Number(m[2])>59){active.clock.style.display='none';return;}
  if(!active.ctx){active.clock.style.display='none';return;}
  var h=Number(m[1])%12,min=Number(m[2]),key=m[1]+':'+m[2];
  if(active.clockKey===key){active.clock.style.display='block';return;}
  var ctx=active.ctx,i,a,x,y;
  ctx.clearRect(0,0,640,640);ctx.save();ctx.scale(4,4);
  ctx.lineCap='round';ctx.strokeStyle='#bcbcbc';ctx.lineWidth=1.2;
  for(i=0;i<12;i++){
   a=i*Math.PI/6;x=Math.sin(a);y=-Math.cos(a);
   ctx.beginPath();ctx.moveTo(80+x*(i%3===0?64:67),80+y*(i%3===0?64:67));
   ctx.lineTo(80+x*73,80+y*73);ctx.stroke();
  }
  ctx.strokeStyle='#eeeeee';ctx.lineWidth=1.8;
  a=(h*30+min/2)*Math.PI/180;
  ctx.beginPath();ctx.moveTo(80,80);ctx.lineTo(80+38*Math.sin(a),80-38*Math.cos(a));ctx.stroke();
  a=min*Math.PI/30;
  ctx.beginPath();ctx.moveTo(80,80);ctx.lineTo(80+58*Math.sin(a),80-58*Math.cos(a));ctx.stroke();
  ctx.fillStyle='#eeeeee';ctx.beginPath();ctx.arc(80,80,2.1,0,Math.PI*2,false);ctx.fill();
  ctx.restore();active.clockKey=key;active.clock.style.display='block';
 }

 // Read-only presentation of the active v74 List2 control. Native data/actions are untouched.
 var arcView=null,arcFailureControl=null,arcFailureWrapper=null;
/* Native settings category view for the inspected v74 framework. No MMUI intents are constructed here. */
function CmuSettingsCategories(w,d,f){
 'use strict';
 var active=false,mode='content',pendingUntil=-1,now=0,title='',focus=0,view=null,current=null,bridge=null,disposed=false;
 function remove(node){if(node&&node.parentNode){node.parentNode.removeChild(node);}}
 function clearView(){
  if(d.body&&d.body.classList){d.body.classList.remove('cmu-settings-adapted');}
  if(!view){return;}
  if(view.list&&view.list.divElt){view.list.divElt.classList.remove('cmu-settings-covered');}
  if(view.tabs&&view.tabs.divElt){view.tabs.divElt.classList.remove('cmu-settings-native-tabs');}
  remove(view.overlay);remove(view.heading);view=null;
 }
 function frame(){
  try{
   var t=f._currTmpltInstance,common=f.common,list=t&&t.list2Ctrl,tabs=list&&list.tabsCtrl,p=tabs&&tabs.properties;
   if(!common||common._cachedTemplate!==t||!t.properties||t.properties.isDialog===true||!list||!list.properties||list.properties.inDialog===true||!tabs||!tabs.divElt||!list.divElt||!p||p.tabsGroup!=='settings'||typeof tabs._selectTabCallback!=='function'||typeof common._statusBarClicked!=='function'){return null;}
   var voice=common._cachedVuiState;
   if(common.cmnCtrlsDisabled||common._vuiHelpDialog||common._vuiExamplesDialog||(voice!==null&&typeof voice!=='undefined'&&voice!=='Idle'&&voice!=='Not Ready'&&voice!=='Playing Out of Session Alert')){return null;}
   var config=p.tabsConfig,rows=[],i,c,label;
   if(typeof p.currentlySelectedTab!=='number'||!isFinite(p.currentlySelectedTab)||Math.floor(p.currentlySelectedTab)!==p.currentlySelectedTab){return null;}
   if(Object.prototype.toString.call(config)!=='[object Array]'||config.length<1||config.length>32||p.currentlySelectedTab<0||p.currentlySelectedTab>=config.length){return null;}
   for(i=0;i<config.length;i++){
    c=config[i];if(!c||typeof c!=='object'){return null;}
    label=c.labelId?f.localize.getLocStr(tabs.uiaId,c.labelId,c.subMap):c.label;
    if(typeof label!=='string'||!label.length){return null;}
    rows.push({config:c,index:i,label:label,disabled:!!c.disabled||typeof (typeof c.selectCallback==='function'?c.selectCallback:p.defaultSelectCallback)!=='function'});
   }
   return {template:t,list:list,tabs:tabs,rows:rows,config:config,selected:p.currentlySelectedTab};
  }catch(invalidFrame){return null;}
 }
 function enabledIndex(a,start,direction){
  for(var i=start;i>=0&&i<a.length;i+=direction){if(!a[i].disabled){return i;}}
  return -1;
 }
 function chooseFocus(a,selected){
  if(selected>=0&&selected<a.length&&!a[selected].disabled){return selected;}
  return enabledIndex(a,0,1);
 }
 function add(tag,name,parent){var node=d.createElement(tag);node.className=name;parent.appendChild(node);return node;}
 function invoke(index,expected){
  try{if(typeof f.getInputEnabled!=='function'||f.getInputEnabled()===false){return false;}}catch(inputUnavailable){return false;}
  var next=frame(),row=next&&next.rows[index];
  // A pending click must never act on a reordered/replaced configuration.
  if(!active||mode!=='categories'||!row||row.config!==expected||row.disabled){tick(now);return false;}
  focus=index;mode='content';clearView();current=next;
  try{next.tabs._selectTabCallback(null,index,null);tick(now);return true;}
  catch(callbackFailure){active=false;clearView();restoreBridge();return false;}
 }
 function firstRow(a){return Math.max(0,Math.min(focus-4,a.rows.length-6));}
 function populateRows(a){
  var i,row,button,first=firstRow(a),end=Math.min(a.rows.length,first+6);
  for(i=0;i<view.buttons.length;i++){remove(view.buttons[i].button);}
  view.buttons=[];view.first=first;view.focus=focus;
  for(i=first;i<end;i++){
   (function(row){
    var button=add('button','cmu-settings-category-row'+(row.index===focus?' cmu-settings-category-current':''),view.overlay);
    button.type='button';button.textContent=row.label;button.disabled=row.disabled;
    button.style.top=(54+(row.index-first)*54)+'px';button.setAttribute('aria-current',row.index===focus?'true':'false');
    button.onclick=function(){invoke(row.index,row.config);};view.buttons.push({button:button,index:row.index});
   })(a.rows[i]);
  }
 }
 function updateFocus(a){
  if(view.first!==firstRow(a)){populateRows(a);}
  else if(view.focus!==focus){
   for(var i=0;i<view.buttons.length;i++){
    var entry=view.buttons[i];entry.button.classList.remove('cmu-settings-category-current');
    if(entry.index===focus){entry.button.classList.add('cmu-settings-category-current');}
    entry.button.setAttribute('aria-current',entry.index===focus?'true':'false');
   }
   view.focus=focus;
  }
  if(view.scroll){view.scroll.focussedItem=focus;}
 }
 function render(a){
  var signature=[],i,selectedLabel='';
  for(i=0;i<a.rows.length;i++){signature.push(a.rows[i].label+'|'+a.rows[i].disabled);}
  signature=signature.join('\n')+'|'+a.selected+'|'+mode;
  var sameRefs=view&&view.config===a.config;
  if(sameRefs){for(i=0;i<a.rows.length;i++){if(view.refs[i]!==a.rows[i].config){sameRefs=false;break;}}}
  if(view&&view.list===a.list&&view.tabs===a.tabs&&view.signature===signature&&sameRefs){if(mode==='categories'){updateFocus(a);}return;}
  clearView();
  view={list:a.list,tabs:a.tabs,config:a.config,refs:[],overlay:null,heading:null,signature:signature,scroll:null,buttons:[],first:0,focus:focus};
  for(i=0;i<a.rows.length;i++){view.refs.push(a.rows[i].config);}
  d.body.classList.add('cmu-settings-adapted');
  a.tabs.divElt.classList.add('cmu-settings-native-tabs');
  if(mode==='content'){
   if(a.rows[a.selected]){selectedLabel=a.rows[a.selected].label;}
   view.heading=add('div','cmu-settings-content-heading',a.list.divElt);view.heading.textContent=selectedLabel;return;
  }
  a.list.divElt.classList.add('cmu-settings-covered');
  var overlay=add('div','cmu-settings-categories',d.body);view.overlay=overlay;
  overlay.setAttribute('role','region');overlay.setAttribute('aria-label',title);
  var heading=add('div','cmu-settings-categories-heading',overlay);heading.textContent=title;
  populateRows(a);
  var marker=add('div','cmu-settings-category-scroll-marker',overlay);
  view.scroll={divElt:overlay,scrollIndicatorWrapper:marker,properties:{showScrollIndicator:true},dataList:{itemCountKnown:true,itemCount:a.rows.length},focussedItem:focus};
 }
 function showCategories(a){mode='categories';focus=chooseFocus(a.rows,a.selected);clearView();current=a;render(a);}
 function restoreBridge(){
  var b=bridge;bridge=null;if(!b){return;}
  if(b.common.handleControllerEvent===b.wrapper){if(b.own){b.common.handleControllerEvent=b.original;}else{delete b.common.handleControllerEvent;}}
 }
 function installBridge(){
  var common=f.common;
  if(bridge&&bridge.common===common){return;}
  restoreBridge();
  if(!common||typeof common.handleControllerEvent!=='function'){return;}
  var b={common:common,original:common.handleControllerEvent,own:Object.prototype.hasOwnProperty.call(common,'handleControllerEvent'),wrapper:null};
  b.wrapper=function(eventId,firstEvent){
   if(disposed||!active){return b.original.apply(this,arguments);}
   var a=frame(),remote=this.statusBar&&this.statusBar.remoteUiBtn;
   var left=this.leftBtn&&this.leftBtn.btnInstance;
   if(!a||(remote&&remote.hasFocus)||(left&&left.hasFocus)){return b.original.apply(this,arguments);}
   if(eventId==='goBack'){
    if(mode==='content'){showCategories(a);return;}
    // This root view is only armed by the native Home->Settings action.
    // Delegate its return to the exact OEM Home-button handler, including its diagnostic guard.
    active=false;clearView();restoreBridge();return this._statusBarClicked(null,null,{statusBtn:'home'});
   }
   if(mode!=='categories'||firstEvent){return b.original.apply(this,arguments);}
   var direction=eventId==='cw'||eventId==='down'?1:(eventId==='ccw'||eventId==='up'?-1:0);
   if(direction){
    var target=enabledIndex(a.rows,focus+direction,direction);
    if(target!==-1){focus=target;current=a;render(a);}return;
   }
   if(eventId==='select'){if(a.rows[focus]){invoke(focus,a.rows[focus].config);}return;}
   if(eventId==='selectStart'||eventId==='selectHold'||eventId==='upStart'||eventId==='downStart'||eventId==='leftStart'||eventId==='rightStart'||eventId==='left'||eventId==='right'){return;}
   return b.original.apply(this,arguments);
  };
  common.handleControllerEvent=b.wrapper;bridge=b;
 }
 function tick(ms){
  if(disposed){return;}
  now=ms;
  try{
   if(active&&f.getCurrentApp()==='system'&&f.getCurrCtxtId()==='HomeScreen'){active=false;clearView();restoreBridge();current=null;return;}
   if(!active&&pendingUntil<now){pendingUntil=-1;return;}
   var a=frame();
   if(!a){clearView();current=null;return;}
   if(!active){
    if(pendingUntil<now){return;}
    pendingUntil=-1;active=true;mode='categories';focus=chooseFocus(a.rows,a.selected);
   }
   current=a;
   if(mode==='categories'&&(focus<0||focus>=a.rows.length||a.rows[focus].disabled)){focus=chooseFocus(a.rows,a.selected);}
   installBridge();render(a);
  }catch(viewFailure){active=false;clearView();restoreBridge();current=null;}
 }
 return {
  armFromHome:function(label,ms){if(!disposed&&typeof label==='string'&&label.length){title=label;pendingUntil=ms+15000;}},
  cancelPending:function(){pendingUntil=-1;},
  tick:tick,
  scrollControl:function(){return view&&mode==='categories'?view.scroll:null;},
  showingCategories:function(){return active&&mode==='categories'&&!!view;},
  snapshot:function(){return {active:active,mode:mode,focus:focus,count:current?current.rows.length:0,pending:pendingUntil>=now};},
  dispose:function(){if(disposed){return;}disposed=true;active=false;pendingUntil=-1;clearView();restoreBridge();current=null;}
 };
}

 function releaseArc(){
  var a=arcView;arcView=null;
  if(!a){return;}
  if(a.wrapper&&a.wrapper.classList){a.wrapper.classList.remove('cmu-next-arc-scroll-owned');}
  if(a.canvas&&a.canvas.parentNode){a.canvas.parentNode.removeChild(a.canvas);}
 }
 function arcPoint(t){var angle=-Math.PI/2+Math.PI*t;return [54+54*Math.cos(angle),178+178*Math.sin(angle)];}
 function arcEase(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
 function paintArc(a,index,total){
  var ctx=a.ctx,length=.86*Math.max(.10,Math.min(.40,2/total));
  var progress=total>1?index/(total-1):.5,start=.07+progress*(.86-length),end=start+length;
  var pass,i,u,v,p,q,strength;
  ctx.clearRect(0,0,216,712);ctx.save();ctx.scale(2,2);ctx.lineCap='round';
  for(pass=0;pass<2;pass++){
   for(i=0;i<100;i++){
    u=i/100;v=(i+1)/100;
    strength=arcEase(Math.min((u+v)/2,1-(u+v)/2)/.26);
    p=arcPoint(start+length*u);q=arcPoint(start+length*v);
    ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);
    ctx.strokeStyle='rgba(255,255,255,'+(strength*(pass===0?.025:.88))+')';
    ctx.lineWidth=pass===0?10:1+4*strength;
    ctx.shadowColor='rgba(255,255,255,'+(strength*.32)+')';ctx.shadowBlur=pass===0?7:2;
    ctx.stroke();
   }
  }
  ctx.restore();
  // Diagnostic values belong only to our own canvas, never the native control.
  a.canvas.cmuArcPosition={index:index,total:total,progress:progress,start:start,end:end};
 }
 function syncArc(control){
  try{
   var data=control&&control.dataList,props=control&&control.properties;
   var wrapper=control&&control.scrollIndicatorWrapper,index=control&&control.focussedItem;
   var total=data&&data.itemCount;
   var valid=control&&data&&props&&props.showScrollIndicator===true&&data.itemCountKnown===true&&
    typeof total==='number'&&isFinite(total)&&total>0&&Math.floor(total)===total&&
    typeof index==='number'&&isFinite(index)&&Math.floor(index)===index&&index>=0&&index<total&&
    wrapper&&wrapper.classList&&wrapper.parentNode&&control.divElt&&control.divElt.parentNode;
   if(valid&&d.body.contains&&!d.body.contains(control.divElt)){valid=false;}
   if(!valid){releaseArc();arcFailureControl=null;arcFailureWrapper=null;return;}
   if(arcView&&(arcView.control!==control||arcView.wrapper!==wrapper)){releaseArc();}
   if(arcFailureControl===control&&arcFailureWrapper===wrapper){return;}
   arcFailureControl=null;arcFailureWrapper=null;
   if(!arcView){
    var a={control:control,wrapper:wrapper,canvas:d.createElement('canvas'),ctx:null,key:null};
    arcView=a;a.canvas.className='cmu-next-arc-scroll';a.canvas.width=216;a.canvas.height=712;
    a.canvas.setAttribute('aria-hidden','true');
    a.ctx=a.canvas.getContext?a.canvas.getContext('2d'):null;
    if(!a.ctx){arcFailureControl=control;arcFailureWrapper=wrapper;releaseArc();return;}
    d.body.appendChild(a.canvas);
   }
   var key=index+'/'+total;
   if(arcView.key!==key){paintArc(arcView,index,total);arcView.key=key;}
   // Hide the native rail only after a valid thumb has been successfully drawn.
   wrapper.classList.add('cmu-next-arc-scroll-owned');
  }catch(arcFailure){if(arcView){arcFailureControl=control;arcFailureWrapper=wrapper;}releaseArc();}
 }

 function stop(){if(closed){return;}closed=true;categories.dispose();releaseArc();unmark();restoreBack();detach();if(timer!==null){w.clearInterval(timer);}if(style.parentNode){style.parentNode.removeChild(style);}}
 function update(){
  try{
   var app=f.getCurrentApp(),context=f.getCurrCtxtId(),home=app==='system'&&context==='HomeScreen';
   var template=f._currTmpltInstance,c=template&&template.mainMenuControl;
   unmark();
   if(active&&(!home||active.control!==c)){detach();}
   if(home){
    syncBack(false);
    if(!active&&!attach(c)){return;}
    mark('cmu-skin-05');mark('cmu-layout-home-05');clock();
   }else if((app==='system'&&['Entertainment','Applications','Communication','VehicleStatusMonitor','NoConnectionNotify'].indexOf(context)!==-1)||['syssettings','vehsettings','audiosettings','btpairing','vdt','driverid','btaudio','satradio','dab','email','vsm','netmgmt','cd','xmaudio','favorites','sms','amradio','stitcher','aharadio','schedmaint','ecoenergy','usbaudio','phone','pandora','auxin','contacts','fmradio','xmdata','idm','tutorial'].indexOf(app)!==-1){
    mark('cmu-skin-05');
    syncBack(true);
    if(app==='system'&&context!=='NoConnectionNotify'){mark('cmu-layout-list-05');}
   }else{syncBack(false);}
   categories.tick(elapsed);
   syncArc(categories.showingCategories()?categories.scrollControl():(!home&&/(?:^|\s)cmu-skin-05(?:\s|$)/.test(d.body.className||'')&&template?template.list2Ctrl:null));
  }catch(ignore){stop();}
 }
 w.__cmuLayout05Stop=stop;update();
 if(!closed){timer=w.setInterval(function(){elapsed+=250;if(elapsed>=600000){stop();}else{update();}},250);}
})(window,document);
