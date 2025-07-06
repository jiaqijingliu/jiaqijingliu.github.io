hexo.extend.filter.register('theme_inject', function (injects) {
  
 
 
  // 引入 APlayer
  injects.head.file('aplayer', 'source/_data/APlayer.swig', {aplayer: hexo.theme.config.aplayer});
  
  
  
});