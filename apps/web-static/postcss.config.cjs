const {resolve}=require('node:path');
const loadConfig=require('tailwindcss/loadConfig.js');
const theme=loadConfig(resolve(__dirname,'../web/tailwind.config.ts'));
module.exports={plugins:[require('tailwindcss')({...theme,content:[resolve(__dirname,'src/**/*.{js,mjs,ts,jsx,tsx}'),resolve(__dirname,'../web/src/**/*.{js,ts,jsx,tsx,mdx}')]}),require('autoprefixer')()]};
