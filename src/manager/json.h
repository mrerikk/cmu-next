#ifndef CMU_JSON_STRING_H
#define CMU_JSON_STRING_H
/* Emit JSON as ASCII for legacy JSONP parsers, including U+2028/U+2029.
 * Invalid or truncated UTF-8 log bytes become U+FFFD, never executable text. */
static void json_string(void (*emit)(const char*),const char*s){
 const unsigned char*p=(const unsigned char*)s;
    char buf[16];
    emit("\"");
 while(*p){unsigned long cp;
        int n=1,k,valid=1;
        unsigned char c=*p;
  if(c<128){p++;
            if(c=='"'||c=='\\'){buf[0]='\\';
                buf[1]=(char)c;
                buf[2]=0;
                emit(buf);
                }
            else if(c<32||c=='<'||c=='>'||c=='&'){(void)snprintf(buf,sizeof(buf),"\\u%04x",c);
                emit(buf);
                }
            else{buf[0]=(char)c;
                buf[1]=0;
                emit(buf);
                }
            continue;
            }
  if(c>=0xc2&&c<=0xdf){n=2;
            cp=c&31;
            }
        else if(c>=0xe0&&c<=0xef){n=3;
            cp=c&15;
            }
        else if(c>=0xf0&&c<=0xf4){n=4;
            cp=c&7;
            }
        else{cp=0xfffd;
            valid=0;
            }
  if(valid){for(k=1;k<n;k++){if(!p[k]||(p[k]&0xc0)!=0x80){valid=0;
                    break;
                    }
                cp=(cp<<6)|(p[k]&63);
                }
            if(valid&&((n==2&&cp<128)||(n==3&&cp<2048)||(n==4&&cp<65536)||(cp>=0xd800&&cp<=0xdfff)||cp>0x10ffff))valid=0;
            }
  if(!valid){cp=0xfffd;
            n=1;
            }
        p+=n;
  if(cp<=65535)(void)snprintf(buf,sizeof(buf),"\\u%04lx",cp);
  else{cp-=65536;
            (void)snprintf(buf,sizeof(buf),"\\u%04lx\\u%04lx",0xd800+(cp>>10),0xdc00+(cp&1023));
            }
        emit(buf);
 }
 emit("\"");
}
#endif
