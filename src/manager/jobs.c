#define _XOPEN_SOURCE 700
#include "sha256.h"
#include <dirent.h>
#include <sys/wait.h>
#include <signal.h>
#include <time.h>
#include "json.h"

/* Job journal candidate. RAM-lab workspaces only; no live startup or installation.
 * Request acceptance and result records are atomic and fsynced. A worker owns a
 * separate flock, inherited by the dispatcher, independently of the UI/server. */
#define MAXJOBS 256
struct job {int seq,code;
    char request[33],operation[24],item[65],phase[24];
    };
static char work[PATH_MAX],jobs[PATH_MAX],packages[PATH_MAX];
static int ledger=-1,active=-1;
static struct job records[MAXJOBS];
static int count=0;
static int fail(const char*s){fprintf(stderr,"error: %s: %s\n",s,strerror(errno));
    return 2;
    }
static void digest(const char*s,size_t n,char out[65]){sha256 h;
    init(&h);
    (void)update(&h,(const unsigned char*)s,n);
    finish(&h,out);
    }
static int join(char*out,const char*a,const char*b){int n=snprintf(out,PATH_MAX,"%s/%s",a,b);
    return n>0&&n<PATH_MAX;
    }
static int id(const char*s,size_t max){size_t n=strlen(s),i;
    if(!n||n>max)return 0;
    for(i=0;i<n;i++)if(!((s[i]>='a'&&s[i]<='z')||(s[i]>='0'&&s[i]<='9')||s[i]=='-'))return 0;
    return 1;
    }
static int opvalid(const char*s){return !strcmp(s,"install")||!strcmp(s,"rollback")||!strcmp(s,"backup")||!strcmp(s,"restore")||!strcmp(s,"report")||!strcmp(s,"recover");
    }
static int phasevalid(const char*s){return !strcmp(s,"accepted")||!strcmp(s,"running")||!strcmp(s,"succeeded")||!strcmp(s,"failed")||!strcmp(s,"interrupted");
    }
static int regular(const char*p){struct stat s;
    return !lstat(p,&s)&&S_ISREG(s.st_mode);
    }
static int directory(const char*p){struct stat s;
    return !lstat(p,&s)&&S_ISDIR(s.st_mode);
    }
static int readfile(const char*p,char*out,size_t cap){struct stat s;
    int fd=open(p,O_RDONLY|O_NOFOLLOW|O_NONBLOCK);
    ssize_t n;
    if(fd<0)return 0;
    if(fstat(fd,&s)||!S_ISREG(s.st_mode)||s.st_size<0||(size_t)s.st_size>=cap){close(fd);
        return 0;
        }
    n=read(fd,out,cap-1);
    close(fd);
    if(n<0||n!=s.st_size)return 0;
    out[n]=0;
    return 1;
    }
static int syncdir(const char*p){int fd=open(p,O_RDONLY|O_DIRECTORY|O_NOFOLLOW),r;
    if(fd<0)return 0;
    r=fsync(fd);
    close(fd);
    return r==0;
    }
static int writeall(int fd,const char*p,size_t n){while(n){ssize_t r=write(fd,p,n);
        if(r<0&&errno==EINTR)continue;
        if(r<=0)return 0;
        p+=r;
        n-=(size_t)r;
        }
    return 1;
    }
static int newfile(const char*p,const char*data){int fd=open(p,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600),r;
    if(fd<0)return 0;
    r=writeall(fd,data,strlen(data))&&fsync(fd)==0;
    close(fd);
    return r;
    }
static int safe_work(const char*p){char marker[PATH_MAX],text[128],real[PATH_MAX],temp[PATH_MAX],*name;
    if(!realpath(p,real)||!realpath("/tmp",temp))return 0;
    if(strcmp(real,p))return 0;
    name=strrchr(real,'/');
    if(!name||strncmp(name+1,"cmu-manager.",12))return 0;
    *name=0;
    if(strcmp(real,temp))return 0;
    if(!directory(p)||!join(marker,p,"marker")||!readfile(marker,text,sizeof(text))||strcmp(text,"cmu-manager-ram-01\n"))return 0;
    strcpy(work,p);
    return join(jobs,p,"jobs");
    }
static int regularfd(int fd){struct stat s;
    return fd>=0&&!fstat(fd,&s)&&S_ISREG(s.st_mode);
    }
static int lockstate(void){char path[PATH_MAX],marker[64];
    if(mkdir(jobs,0700)&&errno!=EEXIST)return 0;
    if(!directory(jobs)||!syncdir(work)||!join(path,jobs,"format"))return 0;
    if(!regular(path)){if(!newfile(path,"cmu-jobs-v1\n")||!syncdir(jobs))return 0;
        }
    if(!readfile(path,marker,sizeof(marker))||strcmp(marker,"cmu-jobs-v1\n"))return 0;
    if(!join(path,jobs,"ledger.lock"))return 0;
    ledger=open(path,O_RDWR|O_CREAT|O_NOFOLLOW,0600);
    if(!regularfd(ledger)||flock(ledger,LOCK_EX)<0)return 0;
    if(!join(path,jobs,"active.lock"))return 0;
    active=open(path,O_RDWR|O_CREAT|O_NOFOLLOW,0600);
    return regularfd(active);
    }
static int jobdir(int seq,char*out){char name[24];
    (void)snprintf(name,sizeof(name),"j%06d",seq);
    return join(out,jobs,name);
    }
static int save(struct job*j){char dir[PATH_MAX],path[PATH_MAX],temp[PATH_MAX],body[1024],data[1200],hash[65];
    int n;
    if(!jobdir(j->seq,dir)||!join(path,dir,"record")||!join(temp,dir,"record.next"))return 0;
    n=snprintf(body,sizeof(body),"cmu-job-v1\nsequence %d\nrequest %s\noperation %s\nitem %s\nphase %s\ncode %d\n",j->seq,j->request,j->operation,j->item,j->phase,j->code);
    if(n<=0||(size_t)n>=sizeof(body))return 0;
    digest(body,(size_t)n,hash);
    n=snprintf(data,sizeof(data),"%ssha256 %s\n",body,hash);
    if(n<=0||(size_t)n>=sizeof(data))return 0;
 /* A stale record.next is an uncommitted write inside this private job dir.
  * It is never read as accepted state and may only be removed if it is plain. */
 if(access(temp,F_OK)==0){if(!regular(temp)||unlink(temp))return 0;
        }
 if(!newfile(temp,data)||rename(temp,path)||!syncdir(dir))return 0;
    return 1;
    }
static int readjob(int seq,struct job*j){char dir[PATH_MAX],path[PATH_MAX],data[1200],expected[65],actual[65],*hashline;
    int used=0;
    if(!jobdir(seq,dir)||!directory(dir)||!join(path,dir,"record")||!readfile(path,data,sizeof(data)))return 0;
    hashline=strstr(data,"sha256 ");
    if(!hashline||strlen(hashline)!=72)return 0;
    if(sscanf(hashline,"sha256 %64[0-9a-f]\n%n",expected,&used)!=1||used!=72)return 0;
    digest(data,(size_t)(hashline-data),actual);
    if(strcmp(actual,expected))return 0;
    *hashline=0;
    used=0;
    if(sscanf(data,"cmu-job-v1\nsequence %d\nrequest %32[a-z0-9-]\noperation %23[a-z0-9-]\nitem %64[a-z0-9-]\nphase %23[a-z]\ncode %d\n%n",&j->seq,j->request,j->operation,j->item,j->phase,&j->code,&used)!=6||data[used]||j->seq!=seq||!id(j->request,32)||!id(j->item,64)||!opvalid(j->operation)||!phasevalid(j->phase)||j->code < -1||j->code>255)return 0;
 if((!strcmp(j->phase,"succeeded")&&j->code!=0)||((!strcmp(j->phase,"running")||!strcmp(j->phase,"accepted")||!strcmp(j->phase,"interrupted"))&&j->code!=-1)||(!strcmp(j->phase,"failed")&&j->code<=0))return 0;
    return 1;
    }
static int loadjobs(void){DIR*d;
    struct dirent*e;
    int max=0,i;
    d=opendir(jobs);
    if(!d)return 0;
    while((e=readdir(d))){int n=0,used=0;
        if(e->d_name[0]!='j')continue;
        if(sscanf(e->d_name,"j%6d%n",&n,&used)!=1||used!=7||e->d_name[used]||n<1||n>MAXJOBS){closedir(d);
            return 0;
            }
        if(n>max)max=n;
        }
    closedir(d);
    for(i=1;i<=max;i++){if(!readjob(i,&records[i-1]))return 0;
        }
    count=max;
    return 1;
    }
static int held(void){if(!flock(active,LOCK_EX|LOCK_NB)){flock(active,LOCK_UN);
        return 0;
        }
    return errno==EWOULDBLOCK||errno==EAGAIN?1:-1;
    }
static int reconcile(void){int i;
    if(flock(active,LOCK_EX|LOCK_NB)){return errno==EWOULDBLOCK||errno==EAGAIN?1:0;
        }
    for(i=0;i<count;i++){struct job*j=&records[i];
        if(!strcmp(j->phase,"accepted")||!strcmp(j->phase,"running")){strcpy(j->phase,"interrupted");
            j->code=-1;
            if(!save(j)){flock(active,LOCK_UN);
                return 0;
                }
            }
        }
    flock(active,LOCK_UN);
    return 1;
    }
static int needs_recovery(void){int watermark=0,i;
    for(i=0;i<count;i++)if(!strcmp(records[i].operation,"recover")&&!strcmp(records[i].phase,"succeeded"))watermark=records[i].seq;
    for(i=0;i<count;i++){struct job*j=&records[i];
        if(j->seq>watermark&&strcmp(j->operation,"report")&&(!strcmp(j->phase,"failed")||!strcmp(j->phase,"interrupted")))return 1;
        }
    return 0;
    }
static void printjob(const struct job*j){printf("{\"sequence\":%d,\"request\":\"%s\",\"operation\":\"%s\",\"item\":\"%s\",\"phase\":\"%s\",\"code\":%d}",j->seq,j->request,j->operation,j->item,j->phase,j->code);
    }
static int status(void){int i,b=held();
    if(b<0)return fail("active lock");
    printf("{\"version\":\"0.2\",\"mode\":\"ram-lab\",\"active\":%s,\"recovery_required\":%s,\"jobs\":[",b?"true":"false",needs_recovery()?"true":"false");
    for(i=0;i<count;i++){if(i)putchar(',');
        printjob(&records[i]);
        }
    puts("],\"live_installation_ready\":false}");
    return 0;
    }
static void jsonout(const char*s){fputs(s,stdout);
    }
static void jsonquote(const char*s){json_string(jsonout,s);
    }
static void logtext(int seq){char dir[PATH_MAX],path[PATH_MAX],text[4096];
    int fd;
    ssize_t n;
    struct stat st;
    text[0]=0;
    if(jobdir(seq,dir)&&join(path,dir,"output.log")){fd=open(path,O_RDONLY|O_NOFOLLOW|O_NONBLOCK);
        if(fd>=0){if(!fstat(fd,&st)&&S_ISREG(st.st_mode)){if(st.st_size>(off_t)sizeof(text)-1)(void)lseek(fd,st.st_size-(off_t)sizeof(text)+1,SEEK_SET);
                n=read(fd,text,sizeof(text)-1);
                if(n>=0)text[n]=0;
                }
            close(fd);
            }
        }
    jsonquote(text);
    }
static int brief(void){char path[PATH_MAX];
    int b=held();
    struct job*j=count?&records[count-1]:NULL;
    if(b<0)return fail("active lock");
    printf("{\"mode\":\"ram-lab\",\"version\":\"0.2\",\"live_installation_ready\":false,\"busy\":%s,\"recovery_required\":%s,\"job\":%d,\"action\":\"%s\",\"item\":\"%s\",\"phase\":\"%s\",\"exit\":%d,\"backup_available\":",b?"true":"false",needs_recovery()?"true":"false",j?j->seq:0,j?j->operation:"",j?j->item:"",j?j->phase:"idle",j?j->code:0);
    (void)join(path,work,"checkpoint/complete");
    printf("%s,\"log\":",regular(path)?"true":"false");
    if(j)logtext(j->seq);
    else jsonquote("");
    puts("}");
    return 0;
    }
static int lookup(const char*key){int i;
    for(i=0;i<count;i++)if(!strcmp(key,records[i].request)){printf("{\"found\":true,\"job\":");
        printjob(&records[i]);
        puts("}");
        return 0;
        }
    puts("{\"found\":false}");
    return 0;
    }
static int detail(const char*name){int n=0,used=0;
    if(sscanf(name,"j%6d%n",&n,&used)!=1||used!=7||name[used]||n<1||n>count){errno=EINVAL;
        return fail("job id");
        }
    printf("{\"job\":");
    printjob(&records[n-1]);
    printf(",\"log\":");
    logtext(n);
    puts("}");
    return 0;
    }

static int enter_worker(struct job j){int code=255,logfd,fd,status_;
    pid_t task;
    char dir[PATH_MAX],path[PATH_MAX],dispatch[PATH_MAX],pidtext[32];
    struct sigaction sa;
 /* The active lock is shared with the parent submitter and inherited by every
  * dispatcher descendant. Its lifetime, not a saved PID, proves activity. */
 close(ledger);
    ledger=-1;
    (void)setsid();
    memset(&sa,0,sizeof(sa));
    sa.sa_handler=SIG_IGN;
    sigaction(SIGHUP,&sa,NULL);
    signal(SIGPIPE,SIG_IGN);
 if(!jobdir(j.seq,dir)||!join(path,dir,"output.log"))_exit(255);
 logfd=open(path,O_WRONLY|O_APPEND|O_NOFOLLOW,0600);
    if(logfd<0)_exit(255);
 (void)dup2(logfd,STDOUT_FILENO);
    (void)dup2(logfd,STDERR_FILENO);
    close(logfd);
    fd=open("/dev/null",O_RDONLY);
    if(fd>=0){(void)dup2(fd,STDIN_FILENO);
        if(fd>2)close(fd);
        }
 (void)join(path,dir,"runner.pid");
    (void)snprintf(pidtext,sizeof(pidtext),"%ld\n",(long)getpid());
    (void)newfile(path,pidtext);
    (void)syncdir(dir);
 (void)join(path,jobs,"ledger.lock");
    ledger=open(path,O_RDWR|O_NOFOLLOW);
    if(ledger<0||flock(ledger,LOCK_EX))_exit(255);
 if(!readjob(j.seq,&j)||strcmp(j.phase,"accepted"))_exit(255);
    strcpy(j.phase,"running");
    if(!save(&j))_exit(255);
    flock(ledger,LOCK_UN);
 if(getenv("CMU_JOB_LAB_FAULT")&&!strcmp(getenv("CMU_JOB_LAB_FAULT"),"after-running"))kill(getpid(),SIGKILL);
 task=fork();
    if(task<0){code=255;
        }
    else if(!task){close(ledger);
        if(!join(dispatch,work,"dispatch.sh"))_exit(127);
        execl("/bin/sh","sh",dispatch,work,packages,j.operation,j.item,(char*)NULL);
        _exit(127);
        }
    else{while(waitpid(task,&status_,0)<0){if(errno!=EINTR)_exit(255);
            }
        code=WIFEXITED(status_)?WEXITSTATUS(status_):128+WTERMSIG(status_);
        }
 if(fsync(STDOUT_FILENO))_exit(255);
    if(flock(ledger,LOCK_EX))_exit(255);
    if(!readjob(j.seq,&j))_exit(255);
    j.code=code;
    strcpy(j.phase,code?"failed":"succeeded");
    if(!save(&j))_exit(255);
 if(getenv("CMU_JOB_LAB_FAULT")&&!strcmp(getenv("CMU_JOB_LAB_FAULT"),"after-result"))kill(getpid(),SIGKILL);
 flock(ledger,LOCK_UN);
    close(ledger);
    close(active);
    _exit(code);
}
static int submit(const char*operation,const char*item,const char*request){struct job j;
    char dir[PATH_MAX],path[PATH_MAX];
    pid_t runner;
    int i;
 if(!opvalid(operation)||!id(item,64)||!id(request,32)){errno=EINVAL;
        return fail("request");
        }
 for(i=0;i<count;i++)if(!strcmp(records[i].request,request)){if(strcmp(records[i].operation,operation)||strcmp(records[i].item,item)){errno=EINVAL;
            return fail("request key reused with different action");
            }
        printf("{\"duplicate\":true,\"job\":");
        printjob(&records[i]);
        puts("}");
        return 0;
        }
 if(count>=MAXJOBS){errno=ENOSPC;
        return fail("job limit");
        }
 if(held()!=0){errno=EBUSY;
        return fail("worker remains active");
        }
 if(!reconcile()){errno=EIO;
        return fail("reconcile");
        }
 if(needs_recovery()&&strcmp(operation,"recover")&&strcmp(operation,"report")){errno=EBUSY;
        return fail("recovery required");
        }
 if(flock(active,LOCK_EX|LOCK_NB)){return fail("active lock");
        }
 memset(&j,0,sizeof(j));
    j.seq=count+1;
    j.code=-1;
    strcpy(j.request,request);
    strcpy(j.operation,operation);
    strcpy(j.item,item);
    strcpy(j.phase,"accepted");
 if(!jobdir(j.seq,dir)||mkdir(dir,0700)||!syncdir(jobs)||!join(path,dir,"output.log")||!newfile(path,"")||!save(&j)){return fail("durable acceptance");
        }
 /* A deliberate fault point for host crash tests, never enabled by the UI. */
 if(getenv("CMU_JOB_LAB_FAULT")&&!strcmp(getenv("CMU_JOB_LAB_FAULT"),"after-accept"))kill(getpid(),SIGKILL);
 runner=fork();
    if(runner<0)return fail("worker fork");
    if(!runner)enter_worker(j);
 printf("{\"duplicate\":false,\"job\":");
    printjob(&j);
    puts("}");
 /* Do not LOCK_UN: the worker inherited the same open file description. */
 close(active);
    active=-1;
    return 0;
}
int main(int argc,char**argv){int result;
    char dispatch[PATH_MAX],hash[65];
 if(argc==2&&!strcmp(argv[1],"version")){puts("cmu-job-journal 0.2");
        return 0;
        }
 if(argc==2&&!strcmp(argv[1],"selftest")){digest("abc",3,hash);
        puts(hash);
        return strcmp(hash,"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")!=0;
        }
 if(argc<3||!safe_work(argv[2])){errno=EINVAL;
        return fail("marked RAM-lab workspace required");
        }
 if(!strcmp(argv[1],"submit")){
  if(argc!=7||strlen(argv[3])>=PATH_MAX||!directory(argv[3])){errno=EINVAL;
            return fail("submit arguments");
            }
        strcpy(packages,argv[3]);
        if(!join(dispatch,work,"dispatch.sh")||!regular(dispatch)){errno=EINVAL;
            return fail("fixed dispatcher required");
            }
 }
    else if(!strcmp(argv[1],"lookup")||!strcmp(argv[1],"job")){if(argc!=4||!id(argv[3],32)){errno=EINVAL;
            return fail("query");
            }
        }
 else if(argc!=3||(strcmp(argv[1],"status")&&strcmp(argv[1],"brief"))){errno=EINVAL;
        return fail("command");
        }
 if(!lockstate()||!loadjobs()){errno=EINVAL;
        result=fail("journal damaged or not writable");
        }
 else if(strcmp(argv[1],"submit")){if(!reconcile())result=fail("reconcile");
        else if(!strcmp(argv[1],"brief"))result=brief();
        else if(!strcmp(argv[1],"lookup"))result=lookup(argv[3]);
        else if(!strcmp(argv[1],"job"))result=detail(argv[3]);
        else result=status();
        }
 else result=submit(argv[4],argv[5],argv[6]);
 if(active>=0)close(active);
    if(ledger>=0)close(ledger);
    return result;
}
