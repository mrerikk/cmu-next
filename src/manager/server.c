#define _POSIX_C_SOURCE 200809L
#ifdef __APPLE__
#define _DARWIN_C_SOURCE
#endif
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <sys/select.h>
#include <sys/file.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <fcntl.h>
#include <unistd.h>
#include <signal.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <ctype.h>
#include <dirent.h>
#include <limits.h>
#include "json.h"

/* Local action service prototype. Its dispatcher is restricted to a marked RAM lab.
 * No command text, arbitrary executable paths, live mounts or startup hooks are accepted. */
static volatile sig_atomic_t stopped=0,stop_signal=0;
static char output[131072],token[65],workdir[PATH_MAX],packdir[PATH_MAX];
static size_t used;
static time_t deadline=0;
static int expired=0,remaining=0;
static int lifetime(void){struct timespec ts;
    if(!deadline)return 1;
    if(clock_gettime(CLOCK_MONOTONIC,&ts))return 0;
    remaining=ts.tv_sec>=deadline?0:(int)(deadline-ts.tv_sec);
    expired=remaining==0;
    return 1;
    }
static void stop_handler(int sig){stop_signal=sig;
    stopped=1;
    }
static void put(const char*s){size_t n=strlen(s);
    if(used+n>=sizeof(output)-1){stopped=1;
        return;
        }
    memcpy(output+used,s,n);
    used+=n;
    output[used]=0;
    }
static void quote(const char*s){json_string(put,s);
    }
static int safeid(const char*s,size_t max){size_t i,n=strlen(s);
    if(!n||n>max)return 0;
    for(i=0;i<n;i++)if(!((s[i]>='a'&&s[i]<='z')||(s[i]>='0'&&s[i]<='9')||s[i]=='-'))return 0;
    return 1;
    }
static int pathjoin(char*out,size_t size,const char*a,const char*b){int n=snprintf(out,size,"%s/%s",a,b);
    return n>0&&(size_t)n<size;
    }
static int plain(const char*p,int directory){struct stat s;
    if(lstat(p,&s))return 0;
    return directory?S_ISDIR(s.st_mode):S_ISREG(s.st_mode);
    }
static int load(const char*p,char*out,size_t size){int fd=open(p,O_RDONLY|O_NOFOLLOW|O_NONBLOCK);
    struct stat s;
    ssize_t n;
    if(fd<0)return 0;
    if(fstat(fd,&s)||!S_ISREG(s.st_mode)||s.st_size<0||(size_t)s.st_size>=size){close(fd);
        return 0;
        }
    n=read(fd,out,size-1);
    close(fd);
    if(n<0||n!=s.st_size)return 0;
    out[n]=0;
    return 1;
    }
/* Fixed helper only. HTTP correlation IDs never serve as action identity. */
static int ledger(const char*command,const char*op,const char*item,const char*key,char*out,size_t size){
 char helper[PATH_MAX];
    int pipes[2],status;
    pid_t pid;
    size_t n=0;
    ssize_t got;
 if(!pathjoin(helper,sizeof(helper),workdir,"cmu-jobs")||!plain(helper,0)||pipe(pipes))return 0;
 pid=fork();
    if(pid<0){close(pipes[0]);
        close(pipes[1]);
        return 0;
        }
 if(!pid){close(pipes[0]);
        if(dup2(pipes[1],STDOUT_FILENO)<0)_exit(127);
        close(pipes[1]);
  if(!strcmp(command,"submit"))execl(helper,helper,command,workdir,packdir,op,item,key,(char*)NULL);
  else if(!strcmp(command,"lookup")||!strcmp(command,"job"))execl(helper,helper,command,workdir,item,(char*)NULL);
  else execl(helper,helper,command,workdir,(char*)NULL);
        _exit(127);
 }
 close(pipes[1]);
    while((got=read(pipes[0],out+n,size-1-n))>0){n+=(size_t)got;
        if(n==size-1)break;
        }
 close(pipes[0]);
    while(waitpid(pid,&status,0)<0){if(errno!=EINTR)return 0;
        }
    out[n]=0;
 return WIFEXITED(status)&&WEXITSTATUS(status)==0&&n>2&&n<size-1&&out[0]=='{'&&out[n-1]=='\n'&&out[n-2]=='}';
}
static int randomhex(char*out,int bytes){unsigned char buf[32];
    int fd,i;
    ssize_t n;
    size_t used_=0;
    if(bytes<1||bytes>32)return 0;
    fd=open("/dev/urandom",O_RDONLY);
    if(fd<0)return 0;
    while(used_<(size_t)bytes){n=read(fd,buf+used_,(size_t)bytes-used_);
        if(n<=0){close(fd);
            return 0;
            }
        used_+=(size_t)n;
        }
    close(fd);
    for(i=0;i<bytes;i++)(void)snprintf(out+i*2,3,"%02x",buf[i]);
    return 1;
    }
static int hexkey(const char*s,size_t len){size_t i;
    if(strlen(s)!=len)return 0;
    for(i=0;i<len;i++)if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f')))return 0;
    return 1;
    }
static void statusdata(char*data){char value[32];
    size_t n=strlen(data);
    data[n-2]=0;
    put(data);
    put(",\"accepting_actions\":");
    put(expired?"false":"true");
    put(",\"session_seconds_remaining\":");
    if(!deadline)put("null");
    else{(void)snprintf(value,sizeof(value),"%d",remaining);
        put(value);
        }
    put("}");
    }
static void catalogdata(void){DIR*d;
    struct dirent*e;
    char packages[PATH_MAX],dir[PATH_MAX],p[PATH_MAX],text[4096],name[160],version[40],kind[24],module[PATH_MAX];
    int count=0;
    put("{\"items\":[");
    if(!pathjoin(packages,sizeof(packages),packdir,"packages")){put("]}");
        return;
        }
    d=opendir(packages);
    if(!d){put("]}");
        return;
        }
    while((e=readdir(d))&&count<32){char *line,*save;
        int valid=1,header=0;
        name[0]=version[0]=kind[0]=0;
        if(!safeid(e->d_name,64)||!pathjoin(dir,sizeof(dir),packages,e->d_name)||!plain(dir,1)||!pathjoin(p,sizeof(p),dir,"package.tsv")||!load(p,text,sizeof(text)))continue;
        for(line=strtok_r(text,"\n",&save);line;line=strtok_r(NULL,"\n",&save)){if(!header){header=1;
                if(strcmp(line,"cmu-package-v1"))valid=0;
                }
            else if(!strncmp(line,"name ",5)){if(name[0]||strlen(line+5)>=sizeof(name))valid=0;
                else strcpy(name,line+5);
                }
            else if(!strncmp(line,"version ",8)){if(version[0]||strlen(line+8)>=sizeof(version))valid=0;
                else strcpy(version,line+8);
                }
            else if(!strncmp(line,"kind ",5)){if(kind[0]||strlen(line+5)>=sizeof(kind))valid=0;
                else strcpy(kind,line+5);
                }
            else valid=0;
            }
 if(!valid||!header||!name[0]||!version[0]||(strcmp(kind,"theme")&&strcmp(kind,"app")))continue;
 if(!pathjoin(module,sizeof(module),dir,"module")||!plain(module,1)||!pathjoin(p,sizeof(p),module,"module.tsv")||!plain(p,0))continue;
 if(count++)put(",");
        put("{\"id\":");
        quote(e->d_name);
        put(",\"name\":");
        quote(name);
        put(",\"version\":");
        quote(version);
        put(",\"kind\":");
        quote(kind);
        put("}");
 }
    closedir(d);
    put("]}");
    }
static void installeddata(void){DIR*d;
    struct dirent*e;
    char dir[PATH_MAX],p[PATH_MAX],phase[40],module[100];
    int count=0;
    (void)pathjoin(dir,sizeof(dir),workdir,"lab/native-state/transactions");
    d=opendir(dir);
    put("{\"items\":[");
    if(d){while((e=readdir(d))&&count<256){char tx[PATH_MAX];
            if(strlen(e->d_name)!=7||e->d_name[0]!='t'||!safeid(e->d_name,7))continue;
            if(!pathjoin(tx,sizeof(tx),dir,e->d_name)||!plain(tx,1)||!pathjoin(p,sizeof(p),tx,"phase")||!load(p,phase,sizeof(phase))||strcmp(phase,"installed\n"))continue;
            (void)pathjoin(p,sizeof(p),tx,"module-id");
            if(!load(p,module,sizeof(module)))continue;
            module[strcspn(module,"\r\n")]=0;
            if(!safeid(module,64))continue;
            if(count++)put(",");
            put("{\"id\":");
            quote(e->d_name);
            put(",\"name\":");
            quote(module);
            put("}");
            }
        closedir(d);
        }
    put("]}");
    }
static int mutation(const char*op,const char*item){size_t i;
 if(!strcmp(op,"install"))return safeid(item,64);
 if(!strcmp(op,"rollback")){if(strlen(item)!=7||item[0]!='t')return 0;
        for(i=1;i<7;i++)if(!isdigit((unsigned char)item[i]))return 0;
        return 1;
        }
 return (!strcmp(op,"backup")||!strcmp(op,"restore")||!strcmp(op,"report")||!strcmp(op,"recover"))&&!strcmp(item,"-");
}
static int actionreceipt(const char*op,const char*item,const char*key,char*out,size_t cap){char found[2048],needle[160];
    int n;
    if(!expired)return ledger("submit",op,item,key,out,cap);
 if(!ledger("lookup","",key,"",found,sizeof(found)))return 0;
 if(strstr(found,"\"found\":false"))return -1;
 (void)snprintf(needle,sizeof(needle),"\"operation\":\"%s\",\"item\":\"%s\"",op,item);
 if(!strstr(found,"\"found\":true")||!strstr(found,needle)||!strchr(found,','))return 0;
 n=snprintf(out,cap,"{\"duplicate\":true,%s",strchr(found,',')+1);
    return n>0&&(size_t)n<cap;
}
static int parse(char*query,char*op,char*item,char*rid,char*key){char *part,*save,*auth=NULL;
    int a=0,b=0,c=0,d=0,e=0;
    for(part=strtok_r(query,"&",&save);part;part=strtok_r(NULL,"&",&save)){char*eq=strchr(part,'=');
        if(!eq)return 0;
        *eq++=0;
        if(!strcmp(part,"token")){if(a++||strlen(eq)!=64)return 0;
            auth=eq;
            }
        else if(!strcmp(part,"op")){if(b++||!safeid(eq,23))return 0;
            strcpy(op,eq);
            }
        else if(!strcmp(part,"id")){if(c++||!safeid(eq,64))return 0;
            strcpy(item,eq);
            }
        else if(!strcmp(part,"rid")){if(d++||!safeid(eq,32))return 0;
            strcpy(rid,eq);
            }
        else if(!strcmp(part,"key")){if(e++||!hexkey(eq,32))return 0;
            strcpy(key,eq);
            }
        else return 0;
        }
    return a==1&&b==1&&d==1&&auth&&!strcmp(auth,token);
    }
static void sendall(int fd,const char*s){size_t len=strlen(s);
    while(len){ssize_t n=send(fd,s,len,0);
        if(n<=0)return;
        s+=n;
        len-=(size_t)n;
        }
    }
static void serve(int fd){char req[8192],op[24]="",item[65]="-",rid[33]="",key[33]="",data[100000],submission[2048],*end,*q,*line;
    size_t n=0;
    int good=0;
    struct timeval timeout={2,0};
    (void)setsockopt(fd,SOL_SOCKET,SO_RCVTIMEO,&timeout,sizeof(timeout));
    while(n<sizeof(req)-1){ssize_t r=recv(fd,req+n,sizeof(req)-1-n,0);
        if(r<=0)break;
        n+=(size_t)r;
        req[n]=0;
        if(strstr(req,"\r\n\r\n"))break;
        }
    req[n]=0;
    line=strstr(req,"\r\n");
    if(line&&strstr(req,"\r\n\r\n")&&!strncmp(req,"GET /api.js?",12)){*line=0;
        end=strchr(req+12,' ');
        if(end&&!strcmp(end," HTTP/1.1")){*end=0;
            q=req+12;
            good=parse(q,op,item,rid,key);
            }
        }
 used=0;
    output[0]=0;
    if(!lifetime()){stopped=1;
        return;
        }
    if(!good){sendall(fd,"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        return;
        }
 put("window.__cmuManagerReply({\"request\":");
    quote(rid);
    put(",\"ok\":");
 if(!strcmp(op,"catalog")||!strcmp(op,"installed")){put("true,\"data\":");
        if(!strcmp(op,"catalog"))catalogdata();
        else installeddata();
        }
 else if(!strcmp(op,"nonce")){char fresh[33];
        if(expired)put("false,\"error\":\"session-expired\"");
        else if(randomhex(fresh,16)){put("true,\"data\":{\"key\":");
            quote(fresh);
            put("}");
            }
        else put("false,\"error\":\"entropy-unavailable\"");
        }
 else if(!strcmp(op,"status")||!strcmp(op,"history")||!strcmp(op,"lookup")||!strcmp(op,"job")){
  const char*command=!strcmp(op,"status")?"brief":!strcmp(op,"history")?"status":op;
  if((strcmp(op,"lookup")||hexkey(item,32))&&ledger(command,"",item,"",data,sizeof(data))){put("true,\"data\":");
            if(!strcmp(op,"status"))statusdata(data);
            else put(data);
            }
        else put("false,\"error\":\"journal-unavailable\"");
 }
    else if(mutation(op,item)&&hexkey(key,32)){
  int accepted=actionreceipt(op,item,key,submission,sizeof(submission));
        if(accepted>0){put("true,\"submission\":");
            put(submission);
            if(ledger("brief","","","",data,sizeof(data))){put(",\"data\":");
                statusdata(data);
                }
            }
  else{put("false,\"error\":");
            quote(accepted<0?"session-expired":"refused-check-journal");
            }
 }
    else put("false,\"error\":\"invalid-action-or-key\"");
 put("});\n");
    {char header[256];
        (void)snprintf(header,sizeof(header),"HTTP/1.1 200 OK\r\nContent-Type: application/javascript; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Length: %lu\r\nConnection: close\r\n\r\n",(unsigned long)used);
        sendall(fd,header);
        sendall(fd,output);
        }
    }
/* Read-only authenticated probe. Never submits a job or prints the token. */
static int check_service(const char*work,const char*port_text){
 char auth_path[PATH_MAX],auth[65],request[512],response[131072];
 char*end;
    long port;
    int fd,flags,error=0,selected;
    size_t n=0,sent=0;
    ssize_t got;
 socklen_t error_size=sizeof(error);
    struct sockaddr_in address;
    struct timeval timeout={2,0};
    fd_set ready;
 errno=0;
    port=strtol(port_text,&end,10);
    if(errno||!*port_text||*end||port<1024||port>65535)return 2;
 if(!pathjoin(auth_path,sizeof(auth_path),work,"auth")||!load(auth_path,auth,sizeof(auth))||!hexkey(auth,64))return 2;
 fd=socket(AF_INET,SOCK_STREAM,0);
    if(fd<0)return 2;
 flags=fcntl(fd,F_GETFL,0);
    if(flags<0||fcntl(fd,F_SETFL,flags|O_NONBLOCK)<0){close(fd);
        return 2;
        }
 memset(&address,0,sizeof(address));
    address.sin_family=AF_INET;
    address.sin_addr.s_addr=htonl(INADDR_LOOPBACK);
    address.sin_port=htons((unsigned short)port);
 if(connect(fd,(struct sockaddr*)&address,sizeof(address))<0){
  if(errno!=EINPROGRESS){close(fd);
            return 2;
            }
  FD_ZERO(&ready);
        FD_SET(fd,&ready);
        selected=select(fd+1,NULL,&ready,NULL,&timeout);
  if(selected!=1||getsockopt(fd,SOL_SOCKET,SO_ERROR,&error,&error_size)||error){close(fd);
            return 2;
            }
 }
 if(fcntl(fd,F_SETFL,flags)<0){close(fd);
        return 2;
        }
 timeout.tv_sec=2;
    timeout.tv_usec=0;
    (void)setsockopt(fd,SOL_SOCKET,SO_RCVTIMEO,&timeout,sizeof(timeout));
    (void)setsockopt(fd,SOL_SOCKET,SO_SNDTIMEO,&timeout,sizeof(timeout));
 (void)snprintf(request,sizeof(request),"GET /api.js?token=%s&op=status&id=-&rid=health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",auth);
 while(sent<strlen(request)){got=send(fd,request+sent,strlen(request)-sent,0);
        if(got<=0){close(fd);
            return 2;
            }
        sent+=(size_t)got;
        }
 while(n<sizeof(response)-1){got=recv(fd,response+n,sizeof(response)-1-n,0);
        if(got<0){close(fd);
            return 2;
            }
        if(!got)break;
        n+=(size_t)got;
        }
 close(fd);
    response[n]=0;
 if(n>=sizeof(response)-1||strncmp(response,"HTTP/1.1 200 OK\r\n",17)||!strstr(response,"window.__cmuManagerReply({\"request\":\"health\",\"ok\":true,\"data\":{"))return 2;
 puts("service health: authenticated status ok");
    return 0;
}
int main(int argc,char**argv){int server,fd,port,lockfd,opt=1;
    char path[PATH_MAX],marker[100],temp[PATH_MAX];
    struct sockaddr_in address;
    struct sigaction sa;
 if(argc==4&&!strcmp(argv[1],"--check")){signal(SIGPIPE,SIG_IGN);
        return check_service(argv[2],argv[3]);
        }
 /* Fork before setsid: a newly forked child cannot be a process-group leader.
  * The launcher exits; readiness is still authenticated by session.sh. */
 if(argc>=2&&!strcmp(argv[1],"--launch")){
        pid_t child;
        if(argc!=5&&argc!=6)return 2;
        child=fork();
        if(child<0){perror("manager fork");return 2;}
        if(child>0)return 0;
        argc--;argv++;
        }
 /* A terminal-group exit must not terminate this independent temporary service. */
 if(getsid(0)!=getpid()&&setsid()<0){perror("manager detach");
        return 2;
        }
 fd=open("/dev/null",O_RDONLY);
    if(fd<0||dup2(fd,STDIN_FILENO)<0){if(fd>=0)close(fd);
        perror("manager stdin");
        return 2;
        }
    if(fd!=STDIN_FILENO)close(fd);
 fprintf(stderr,"manager event=starting pid=%ld session=%ld group=%ld\n",(long)getpid(),(long)getsid(0),(long)getpgrp());
 if((argc!=4&&argc!=5)||strlen(argv[1])>=sizeof(workdir)||strlen(argv[2])>=sizeof(packdir))return 2;
    strcpy(workdir,argv[1]);
    strcpy(packdir,argv[2]);
    port=atoi(argv[3]);
    if(port<1024||port>65535)return 2;
 if(argc==5){char*end;
        long ttl;
        struct timespec ts;
        errno=0;
        ttl=strtol(argv[4],&end,10);
        if(errno||!*argv[4]||*end||ttl<1||ttl>86400||clock_gettime(CLOCK_MONOTONIC,&ts))return 2;
        deadline=ts.tv_sec+ttl;
        }
 if(!plain(workdir,1)||!pathjoin(path,sizeof(path),workdir,"marker")||!load(path,marker,sizeof(marker))||strcmp(marker,"cmu-manager-ram-01\n"))return 2;
 /* Validate the journal's stricter canonical private RAM path guard before writing. */
 {char check[65536];
        if(!ledger("brief","","","",check,sizeof(check)))return 2;
        }
 (void)pathjoin(path,sizeof(path),workdir,"service.lock");
    lockfd=open(path,O_RDWR|O_CREAT|O_NOFOLLOW,0600);
    if(lockfd<0||flock(lockfd,LOCK_EX|LOCK_NB))return 2;
    (void)fcntl(lockfd,F_SETFD,FD_CLOEXEC);
 (void)pathjoin(path,sizeof(path),workdir,"auth");
    if(!load(path,token,sizeof(token))){if(lstat(path,&(struct stat){0})==0||errno!=ENOENT||!randomhex(token,32))return 2;
        fd=open(path,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600);
        if(fd<0)return 2;
        if(write(fd,token,64)!=64||fsync(fd)){close(fd);
            return 2;
            }
        close(fd);
        }
    if(!hexkey(token,64))return 2;
 server=socket(AF_INET,SOCK_STREAM,0);
    if(server<0)return 2;
    (void)fcntl(server,F_SETFD,FD_CLOEXEC);
    (void)setsockopt(server,SOL_SOCKET,SO_REUSEADDR,&opt,sizeof(opt));
    memset(&address,0,sizeof(address));
    address.sin_family=AF_INET;
    address.sin_addr.s_addr=htonl(INADDR_LOOPBACK);
    address.sin_port=htons((unsigned short)port);
 if(bind(server,(struct sockaddr*)&address,sizeof(address))||listen(server,4)){perror("manager listen");
        close(server);
        return 2;
        }
 memset(&sa,0,sizeof(sa));
    sa.sa_handler=stop_handler;
    sigaction(SIGTERM,&sa,NULL);
    sigaction(SIGINT,&sa,NULL);
    signal(SIGPIPE,SIG_IGN);
    signal(SIGHUP,SIG_IGN);
 /* Publish the actual service PID, never the short-lived launcher's PID. */
 (void)pathjoin(path,sizeof(path),workdir,"service.pid");
    fd=open(path,O_WRONLY|O_CREAT|O_NOFOLLOW|O_NONBLOCK,0600);
    if(fd<0)return 2;
    {struct stat st;
        char pidtext[40];
        int len=snprintf(pidtext,sizeof(pidtext),"%ld\n",(long)getpid());
        if(fstat(fd,&st)||!S_ISREG(st.st_mode)||st.st_nlink!=1||st.st_uid!=geteuid()||
           (st.st_mode&0777)!=0600||ftruncate(fd,0)||write(fd,pidtext,(size_t)len)!=len||fsync(fd)){
            close(fd);return 2;
            }
        }
    close(fd);
 (void)pathjoin(path,sizeof(path),workdir,"client.js");
    (void)pathjoin(temp,sizeof(temp),workdir,"client.next");
    if(lstat(temp,&(struct stat){0})==0){if(!plain(temp,0)||unlink(temp))return 2;
        }
    fd=open(temp,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600);
    if(fd<0)return 2;
    {char cfg[512];
        int len=snprintf(cfg,sizeof(cfg),"window.__cmuManagerConfig={url:'http://127.0.0.1:%d/api.js',token:'%s',mode:'ram-lab',process:%ld};\n",port,token,(long)getpid());
        if(write(fd,cfg,(size_t)len)!=len||fsync(fd)){close(fd);
            return 2;
            }
        }
    close(fd);
    if(rename(temp,path))return 2;

 fprintf(stderr,"manager event=listening port=%d ttl=%ld\n",port,(long)(argc==5?strtol(argv[4],NULL,10):0));
 /* Closing this control process never waits for, kills or repeats a journal job. */
 while(!stopped){fd_set fds;
        struct timeval tv={1,0};
        if(!lifetime())break;
        if(expired){char state[65536];
            if(!ledger("brief","","","",state,sizeof(state))||!strstr(state,"\"busy\":true"))break;
            }
        FD_ZERO(&fds);
        FD_SET(server,&fds);
        if(select(server+1,&fds,NULL,NULL,&tv)>0){fd=accept(server,NULL,NULL);
            if(fd>=0){(void)fcntl(fd,F_SETFD,FD_CLOEXEC);
                serve(fd);
                close(fd);
                }
            }
        }
    fprintf(stderr,"manager event=stopped signal=%d expired=%d\n",(int)stop_signal,expired);
    close(server);
    close(lockfd);
    return 0;
}
