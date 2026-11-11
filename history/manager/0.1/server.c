#define _POSIX_C_SOURCE 200809L
#ifdef __APPLE__
#define _DARWIN_C_SOURCE
#endif
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <sys/select.h>
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

/* Local action service prototype. Its dispatcher is restricted to a marked RAM lab.
 * No command text, arbitrary executable paths, live mounts or startup hooks are accepted. */
static volatile sig_atomic_t stopped=0;
static char output[65536],token[65],workdir[PATH_MAX],packdir[PATH_MAX];
static size_t used;
static pid_t child=0;
static int lastcode=0,serial=0;
static char jobaction[24]="",jobitem[65]="";
struct request {char rid[33],op[24],item[65];int job;};
static struct request seen[32];static int nseen=0;
static void stop_handler(int sig){(void)sig;stopped=1;}
static void put(const char*s){size_t n=strlen(s);if(used+n>=sizeof(output)-1){stopped=1;return;}memcpy(output+used,s,n);used+=n;output[used]=0;}
static void quote(const char*s){const unsigned char*p=(const unsigned char*)s;char b[8];put("\"");for(;*p;p++){if(*p=='"'||*p=='\\'){b[0]='\\';b[1]=(char)*p;b[2]=0;put(b);}else if(*p<32||*p=='<'||*p=='>'||*p=='&'){(void)snprintf(b,sizeof(b),"\\u%04x",*p);put(b);}else{b[0]=(char)*p;b[1]=0;put(b);}}put("\"");}
static int safeid(const char*s,size_t max){size_t i,n=strlen(s);if(!n||n>max)return 0;for(i=0;i<n;i++)if(!((s[i]>='a'&&s[i]<='z')||(s[i]>='0'&&s[i]<='9')||s[i]=='-'))return 0;return 1;}
static int pathjoin(char*out,size_t size,const char*a,const char*b){int n=snprintf(out,size,"%s/%s",a,b);return n>0&&(size_t)n<size;}
static int plain(const char*p,int directory){struct stat s;if(lstat(p,&s))return 0;return directory?S_ISDIR(s.st_mode):S_ISREG(s.st_mode);}
static int load(const char*p,char*out,size_t size){int fd=open(p,O_RDONLY|O_NOFOLLOW|O_NONBLOCK);struct stat s;ssize_t n;if(fd<0)return 0;if(fstat(fd,&s)||!S_ISREG(s.st_mode)||s.st_size<0||(size_t)s.st_size>=size){close(fd);return 0;}n=read(fd,out,size-1);close(fd);if(n<0||n!=s.st_size)return 0;out[n]=0;return 1;}
static void pollchild(void){int status;pid_t p;if(!child)return;p=waitpid(child,&status,WNOHANG);if(p==child){lastcode=WIFEXITED(status)?WEXITSTATUS(status):128+(WIFSIGNALED(status)?WTERMSIG(status):0);child=0;}}
static void integer(int n){char s[32];(void)snprintf(s,sizeof(s),"%d",n);put(s);}
static void statusdata(void){char p[PATH_MAX],log[8192];int fd;ssize_t n;put("{\"mode\":\"ram-lab\",\"live_installation_ready\":false,\"busy\":");put(child?"true":"false");put(",\"job\":");integer(serial);put(",\"action\":");quote(jobaction);put(",\"item\":");quote(jobitem);put(",\"exit\":");integer(lastcode);put(",\"backup_available\":");(void)pathjoin(p,sizeof(p),workdir,"checkpoint/complete");put(plain(p,0)?"true":"false");put(",\"log\":");log[0]=0;(void)pathjoin(p,sizeof(p),workdir,"job.log");fd=open(p,O_RDONLY|O_NOFOLLOW|O_NONBLOCK);if(fd>=0){struct stat s;if(!fstat(fd,&s)&&S_ISREG(s.st_mode)){if(s.st_size>(off_t)sizeof(log)-1)(void)lseek(fd,s.st_size-(off_t)sizeof(log)+1,SEEK_SET);n=read(fd,log,sizeof(log)-1);if(n>=0)log[n]=0;}close(fd);}quote(log);put("}");}
static void catalogdata(void){DIR*d;struct dirent*e;char packages[PATH_MAX],dir[PATH_MAX],p[PATH_MAX],text[4096],name[160],version[40],kind[24],module[PATH_MAX];int count=0;put("{\"items\":[");if(!pathjoin(packages,sizeof(packages),packdir,"packages")){put("]}");return;}d=opendir(packages);if(!d){put("]}");return;}while((e=readdir(d))&&count<32){char *line,*save;int valid=1,header=0;name[0]=version[0]=kind[0]=0;if(!safeid(e->d_name,64)||!pathjoin(dir,sizeof(dir),packages,e->d_name)||!plain(dir,1)||!pathjoin(p,sizeof(p),dir,"package.tsv")||!load(p,text,sizeof(text)))continue;for(line=strtok_r(text,"\n",&save);line;line=strtok_r(NULL,"\n",&save)){if(!header){header=1;if(strcmp(line,"cmu-package-v1"))valid=0;}else if(!strncmp(line,"name ",5)){if(name[0]||strlen(line+5)>=sizeof(name))valid=0;else strcpy(name,line+5);}else if(!strncmp(line,"version ",8)){if(version[0]||strlen(line+8)>=sizeof(version))valid=0;else strcpy(version,line+8);}else if(!strncmp(line,"kind ",5)){if(kind[0]||strlen(line+5)>=sizeof(kind))valid=0;else strcpy(kind,line+5);}else valid=0;}
 if(!valid||!header||!name[0]||!version[0]||(strcmp(kind,"theme")&&strcmp(kind,"app")))continue;
 if(!pathjoin(module,sizeof(module),dir,"module")||!plain(module,1)||!pathjoin(p,sizeof(p),module,"module.tsv")||!plain(p,0))continue;
 if(count++)put(",");put("{\"id\":");quote(e->d_name);put(",\"name\":");quote(name);put(",\"version\":");quote(version);put(",\"kind\":");quote(kind);put("}");
 }closedir(d);put("]}");}
static void installeddata(void){DIR*d;struct dirent*e;char dir[PATH_MAX],p[PATH_MAX],phase[40],module[100];int count=0;(void)pathjoin(dir,sizeof(dir),workdir,"lab/native-state/transactions");d=opendir(dir);put("{\"items\":[");if(d){while((e=readdir(d))&&count<256){char tx[PATH_MAX];if(strlen(e->d_name)!=7||e->d_name[0]!='t'||!safeid(e->d_name,7))continue;if(!pathjoin(tx,sizeof(tx),dir,e->d_name)||!plain(tx,1)||!pathjoin(p,sizeof(p),tx,"phase")||!load(p,phase,sizeof(phase))||strcmp(phase,"installed\n"))continue;(void)pathjoin(p,sizeof(p),tx,"module-id");if(!load(p,module,sizeof(module)))continue;module[strcspn(module,"\r\n")]=0;if(!safeid(module,64))continue;if(count++)put(",");put("{\"id\":");quote(e->d_name);put(",\"name\":");quote(module);put("}");}closedir(d);}put("]}");}
static int action(const char*op,const char*item){char dispatch[PATH_MAX],logpath[PATH_MAX],history[PATH_MAX],previous[PATH_MAX],number[40];int fd;if(!strcmp(op,"install")){if(!safeid(item,64))return 0;}else if(!strcmp(op,"rollback")){size_t i;if(strlen(item)!=7||item[0]!='t')return 0;for(i=1;i<7;i++)if(!isdigit((unsigned char)item[i]))return 0;}else if(strcmp(op,"backup")&&strcmp(op,"restore")&&strcmp(op,"report"))return 0;
 if(child)return -1;
 (void)pathjoin(dispatch,sizeof(dispatch),workdir,"dispatch.sh");(void)pathjoin(logpath,sizeof(logpath),workdir,"job.log");if(serial){(void)pathjoin(history,sizeof(history),workdir,"history");if(mkdir(history,0700)&&errno!=EEXIST)return 0;if(!plain(history,1))return 0;(void)snprintf(number,sizeof(number),"job-%06d.log",serial);(void)pathjoin(previous,sizeof(previous),history,number);if(rename(logpath,previous))return 0;}fd=open(logpath,O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW,0600);if(fd<0)return 0;
 child=fork();if(child<0){child=0;close(fd);return 0;}if(!child){(void)dup2(fd,STDOUT_FILENO);(void)dup2(fd,STDERR_FILENO);close(fd);execl("/bin/sh","sh",dispatch,workdir,packdir,op,item,(char*)NULL);_exit(127);}close(fd);serial++;lastcode=0;strcpy(jobaction,op);strcpy(jobitem,item);return 1;}
static int parse(char*query,char*op,char*item,char*rid){char *part,*save,*auth=NULL;int a=0,b=0,c=0,d=0;for(part=strtok_r(query,"&",&save);part;part=strtok_r(NULL,"&",&save)){char*eq=strchr(part,'=');if(!eq)return 0;*eq++=0;if(!strcmp(part,"token")){if(a++||strlen(eq)!=64)return 0;auth=eq;}else if(!strcmp(part,"op")){if(b++||!safeid(eq,23))return 0;strcpy(op,eq);}else if(!strcmp(part,"id")){if(c++||!safeid(eq,64))return 0;strcpy(item,eq);}else if(!strcmp(part,"rid")){if(d++||!safeid(eq,32))return 0;strcpy(rid,eq);}else return 0;}return a==1&&b==1&&d==1&&auth&&!strcmp(auth,token);}
static void sendall(int fd,const char*s){size_t len=strlen(s);while(len){ssize_t n=send(fd,s,len,0);if(n<=0)return;s+=n;len-=(size_t)n;}}
static void serve(int fd){char req[8192],op[24]="",item[65]="-",rid[33]="",*end,*q,*line;size_t n=0;int good=0,code=0,i;struct timeval timeout={2,0};(void)setsockopt(fd,SOL_SOCKET,SO_RCVTIMEO,&timeout,sizeof(timeout));while(n<sizeof(req)-1){ssize_t r=recv(fd,req+n,sizeof(req)-1-n,0);if(r<=0)break;n+=(size_t)r;req[n]=0;if(strstr(req,"\r\n\r\n"))break;}req[n]=0;line=strstr(req,"\r\n");if(line&&strstr(req,"\r\n\r\n")&&!strncmp(req,"GET /api.js?",12)){*line=0;end=strchr(req+12,' ');if(end&&!strcmp(end," HTTP/1.1")){*end=0;q=req+12;good=parse(q,op,item,rid);}}
 used=0;output[0]=0;if(!good){sendall(fd,"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");return;}
 put("window.__cmuManagerReply({\"request\":");quote(rid);put(",\"ok\":");
 if(!strcmp(op,"status")||!strcmp(op,"catalog")||!strcmp(op,"installed")){put("true,\"data\":");if(!strcmp(op,"status"))statusdata();else if(!strcmp(op,"catalog"))catalogdata();else installeddata();}
 else{int duplicate=0;for(i=0;i<nseen;i++)if(!strcmp(seen[i].rid,rid)){duplicate=1;code=(!strcmp(seen[i].op,op)&&!strcmp(seen[i].item,item)&&seen[i].job==serial)?2:0;break;}if(!duplicate){if(nseen>=32)code=0;else code=action(op,item);if(code>0){strcpy(seen[nseen].rid,rid);strcpy(seen[nseen].op,op);strcpy(seen[nseen].item,item);seen[nseen].job=serial;nseen++;}}
 if(code>0){put("true,\"data\":");statusdata();}else{put("false,\"error\":");quote(code==-1?"busy":"refused");}}
 put("});\n");{char header[256];(void)snprintf(header,sizeof(header),"HTTP/1.1 200 OK\r\nContent-Type: application/javascript; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Length: %lu\r\nConnection: close\r\n\r\n",(unsigned long)used);sendall(fd,header);sendall(fd,output);}}
int main(int argc,char**argv){int server,fd,port,randomfd,i;unsigned char random[32];char path[PATH_MAX],marker[100];struct sockaddr_in address;time_t deadline;struct sigaction sa;
 if(argc!=4||strlen(argv[1])>=sizeof(workdir)||strlen(argv[2])>=sizeof(packdir))return 2;strcpy(workdir,argv[1]);strcpy(packdir,argv[2]);port=atoi(argv[3]);if(port<1024||port>65535)return 2;
 if(!plain(workdir,1)||!pathjoin(path,sizeof(path),workdir,"marker")||!load(path,marker,sizeof(marker))||strcmp(marker,"cmu-manager-ram-01\n"))return 2;
 randomfd=open("/dev/urandom",O_RDONLY);if(randomfd<0)return 2;if(read(randomfd,random,sizeof(random))!=(ssize_t)sizeof(random)){close(randomfd);return 2;}close(randomfd);for(i=0;i<32;i++)(void)snprintf(token+i*2,3,"%02x",random[i]);
 server=socket(AF_INET,SOCK_STREAM,0);if(server<0)return 2;memset(&address,0,sizeof(address));address.sin_family=AF_INET;address.sin_addr.s_addr=htonl(INADDR_LOOPBACK);address.sin_port=htons((unsigned short)port);
 if(bind(server,(struct sockaddr*)&address,sizeof(address))||listen(server,4)){close(server);return 2;}
 (void)pathjoin(path,sizeof(path),workdir,"client.js");fd=open(path,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600);if(fd<0){close(server);return 2;}{char cfg[512];int len=snprintf(cfg,sizeof(cfg),"window.__cmuManagerConfig={url:'http://127.0.0.1:%d/api.js',token:'%s',mode:'ram-lab'};\n",port,token);if(write(fd,cfg,(size_t)len)!=len){close(fd);close(server);return 2;}}close(fd);
 memset(&sa,0,sizeof(sa));sa.sa_handler=stop_handler;sigaction(SIGTERM,&sa,NULL);sigaction(SIGINT,&sa,NULL);signal(SIGPIPE,SIG_IGN);signal(SIGHUP,SIG_IGN);deadline=time(NULL)+900;
 while(!stopped&&(time(NULL)<deadline||child)){fd_set fds;struct timeval tv={1,0};pollchild();FD_ZERO(&fds);FD_SET(server,&fds);if(select(server+1,&fds,NULL,NULL,&tv)>0){fd=accept(server,NULL,NULL);if(fd>=0){serve(fd);close(fd);}}}close(server);if(child)(void)waitpid(child,NULL,0);return 0;
}
