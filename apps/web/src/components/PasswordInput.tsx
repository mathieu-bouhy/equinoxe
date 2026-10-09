import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './ui';
export function PasswordInput(props:InputHTMLAttributes<HTMLInputElement>){
  const [visible,setVisible]=useState(false);
  return <span className="password-input"><Input {...props} type={visible?'text':'password'} autoComplete={props.autoComplete??'new-password'}/><button type="button" className="icon-button" aria-label={visible?'Masquer le mot de passe':'Afficher le mot de passe'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></span>;
}
