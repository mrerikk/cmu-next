#define _POSIX_C_SOURCE 200809L
#ifdef __APPLE__
#define _DARWIN_C_SOURCE
#endif
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/file.h>
#include <inttypes.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>

/* SHA-256 from the algorithm in FIPS 180-4, sections 4--6.
 * Original project implementation; no external crypto or shell dependency.
 * This implementation has NOT undergone NIST validation. */
typedef struct { uint32_t h[8]; uint64_t bytes; unsigned char block[64]; size_t used; } sha256;
static const uint32_t constants[64] = {
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2};
static uint32_t rotate(uint32_t x, unsigned n) { return (x >> n) | (x << (32-n)); }
static void block(sha256 *s, const unsigned char *p) {
 uint32_t w[64],a,b,c,d,e,f,g,h,t1,t2; size_t i;
 for(i=0;i<16;i++) w[i]=((uint32_t)p[i*4]<<24)|((uint32_t)p[i*4+1]<<16)|((uint32_t)p[i*4+2]<<8)|p[i*4+3];
 for(i=16;i<64;i++) { uint32_t x=w[i-15],y=w[i-2];
  w[i]=w[i-16]+(rotate(x,7)^rotate(x,18)^(x>>3))+w[i-7]+(rotate(y,17)^rotate(y,19)^(y>>10)); }
 a=s->h[0];b=s->h[1];c=s->h[2];d=s->h[3];e=s->h[4];f=s->h[5];g=s->h[6];h=s->h[7];
 for(i=0;i<64;i++) {
  t1=h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^((~e)&g))+constants[i]+w[i];
  t2=(rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c));
  h=g;g=f;f=e;e=d+t1;d=c;c=b;b=a;a=t1+t2;
 }
 s->h[0]+=a;s->h[1]+=b;s->h[2]+=c;s->h[3]+=d;s->h[4]+=e;s->h[5]+=f;s->h[6]+=g;s->h[7]+=h;
}
static void init(sha256 *s) {
 static const uint32_t v[8]={0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19};
 memcpy(s->h,v,sizeof(v));s->bytes=0;s->used=0;
}
static int update(sha256 *s, const unsigned char *p, size_t n) {
 if((uint64_t)n > (UINT64_MAX/8)-s->bytes) {errno=EOVERFLOW;return -1;}
 s->bytes+=(uint64_t)n;
 while(n) {size_t take=64-s->used;if(take>n)take=n;
  memcpy(s->block+s->used,p,take);s->used+=take;p+=take;n-=take;
  if(s->used==64) {block(s,s->block);s->used=0;}
 }return 0;
}
static void finish(sha256 *s, char out[65]) {
 uint64_t bits=s->bytes*8;size_t i;
 s->block[s->used++]=0x80;
 if(s->used>56) {memset(s->block+s->used,0,64-s->used);block(s,s->block);s->used=0;}
 memset(s->block+s->used,0,56-s->used);
 for(i=0;i<8;i++)s->block[63-i]=(unsigned char)(bits>>(i*8));
 block(s,s->block);
 for(i=0;i<8;i++) (void)snprintf(out+i*8,9,"%08x",(unsigned)s->h[i]);
 out[64]=0;
}
static int fail(const char *action) {fprintf(stderr,"error: %s: %s\n",action,strerror(errno));return 2;}
static int valid_hash(const char *s) {size_t i;if(strlen(s)!=64)return 0;for(i=0;i<64;i++)if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f')))return 0;return 1;}
static int regular(const char *path, struct stat *st) {
 int fd=open(path,O_RDONLY|O_NOFOLLOW|O_NONBLOCK);
 if(fd<0)return -1;
 if(fstat(fd,st)<0) {int e=errno;close(fd);errno=e;return -1;}
 if(!S_ISREG(st->st_mode)) {close(fd);errno=EINVAL;return -1;}
 return fd;
}
static int same_snapshot(const struct stat *a,const struct stat *b) {
 return a->st_dev==b->st_dev && a->st_ino==b->st_ino && a->st_size==b->st_size && a->st_mtime==b->st_mtime && a->st_ctime==b->st_ctime;
}
static int hash_fd(int fd, char out[65]) {
 sha256 s;unsigned char buf[32768];ssize_t n;init(&s);
 for(;;) {n=read(fd,buf,sizeof(buf));if(n<0) {if(errno==EINTR)continue;return -1;}if(!n)break;if(update(&s,buf,(size_t)n)<0)return -1;}
 finish(&s,out);return 0;
}
static int hash_file(const char *path, char out[65]) {
 struct stat before,after;int fd=regular(path,&before),r,saved;
 if(fd<0)return -1;
 r=hash_fd(fd,out);
 if(r==0) {if(fstat(fd,&after)<0)r=-1;else if(!same_snapshot(&before,&after)){errno=EBUSY;r=-1;}}
 saved=errno;if(close(fd)<0&&r==0)return -1;errno=saved;return r;
}
static int sync_fd(int fd) {
#ifdef CMU_IO_TEST
 static unsigned calls=0;const char *value=getenv("CMU_IO_FAIL_FSYNC");
 calls++;
 if(value && strtoul(value,NULL,10)==calls) {errno=EIO;return -1;}
#endif
 int r;do {r=fsync(fd);}while(r<0&&errno==EINTR);return r;
}
static int flush_path(const char *path, int directory) {
 struct stat st;int fd=open(path,O_RDONLY|O_NOFOLLOW|O_NONBLOCK|(directory?O_DIRECTORY:0)),r,saved;
 if(fd<0)return -1;
 if(fstat(fd,&st)<0) {saved=errno;close(fd);errno=saved;return -1;}
 if(directory?!S_ISDIR(st.st_mode):!S_ISREG(st.st_mode)) {close(fd);errno=EINVAL;return -1;}
 r=sync_fd(fd);
 saved=errno;if(close(fd)<0&&r==0)return -1;errno=saved;return r;
}
/* Creates a new stage file only. Never overwrites or publishes a destination.
 * On any failure the stage may remain; caller must treat it as uncommitted. */
static int stage(const char *source,const char *dest,const char *expected) {
 int in=-1,out=-1,dir=-1,r=-1,saved;struct stat a,b;char hex[65],*parent=NULL,*slash;const char *name;ssize_t n;unsigned char buf[32768];sha256 s;uint64_t total=0;
 in=regular(source,&a);if(in<0)goto done;
 if(a.st_size<0 || (uint64_t)a.st_size>64*1024*1024) {errno=EFBIG;goto done;}
 parent=strdup(dest);if(!parent)goto done;slash=strrchr(parent,'/');
 if(slash) {if(slash==parent) {free(parent);parent=strdup("/");if(!parent)goto done;}else *slash=0;}
 else {free(parent);parent=strdup(".");if(!parent)goto done;}
 name=strrchr(dest,'/');name=name?name+1:dest;
 if(!*name || !strcmp(name,".") || !strcmp(name,"..")) {errno=EINVAL;goto done;}
 dir=open(parent,O_RDONLY|O_DIRECTORY|O_NOFOLLOW);if(dir<0)goto done;
 out=openat(dir,name,O_RDWR|O_CREAT|O_EXCL|O_NOFOLLOW,0600);if(out<0)goto done;
 init(&s);
 for(;;) {
  size_t off=0;n=read(in,buf,sizeof(buf));if(n<0){if(errno==EINTR)continue;goto done;}if(!n)break;
  total+=(uint64_t)n;if(total>64*1024*1024){errno=EFBIG;goto done;}
  if(update(&s,buf,(size_t)n)<0)goto done;
  while(off<(size_t)n) {ssize_t w=write(out,buf+off,(size_t)n-off);if(w<0){if(errno==EINTR)continue;goto done;}if(!w){errno=EIO;goto done;}off+=(size_t)w;}
 }
 finish(&s,hex);
 if(strcmp(hex,expected)) {errno=EINVAL;goto done;}
 if(fstat(in,&b)<0)goto done;
 if(!same_snapshot(&a,&b)||total!=(uint64_t)a.st_size) {errno=EBUSY;goto done;}
 if(sync_fd(out)<0 || lseek(out,0,SEEK_SET)<0 || hash_fd(out,hex)<0)goto done;
 if(strcmp(hex,expected)) {errno=EIO;goto done;}
 if(sync_fd(dir)<0)goto done;
 r=0;
 done:
 saved=errno;
 if(in>=0&&close(in)<0&&r==0){r=-1;saved=errno;}
 if(out>=0&&close(out)<0&&r==0){r=-1;saved=errno;}
 if(dir>=0&&close(dir)<0&&r==0){r=-1;saved=errno;}
 free(parent);errno=saved;return r;
}
static int metadata(const char *path) {
 struct stat st;int fd=regular(path,&st);long ns;
 if(fd<0)return fail("metadata");
#ifdef __APPLE__
 ns=st.st_mtimespec.tv_nsec;
#else
 ns=st.st_mtim.tv_nsec;
#endif
 if(close(fd)<0)return fail("metadata close");
 printf("%04o %ju %ju %jd %ld %jd\n",(unsigned)(st.st_mode&07777),(uintmax_t)st.st_uid,(uintmax_t)st.st_gid,(intmax_t)st.st_mtime,ns,(intmax_t)st.st_size);
 return 0;
}
static int lock_run(int argc,char **argv) {
 struct stat st;int fd;char text[32];
 if(argc<5){errno=EINVAL;return fail("lock-run args");}
 fd=open(argv[2],O_RDWR|O_CREAT|O_NOFOLLOW|O_NONBLOCK,0600);
 if(fd<0)return fail("lock open");
 if(fstat(fd,&st)<0||!S_ISREG(st.st_mode)){close(fd);errno=EINVAL;return fail("lock type");}
 if(flock(fd,LOCK_EX|LOCK_NB)<0){close(fd);fputs("error: transaction lock busy\n",stderr);return 75;}
 (void)snprintf(text,sizeof(text),"%d",fd);
 if(setenv("CMU_IO_LOCK_FD",text,1)<0){close(fd);return fail("lock env");}
 execv(argv[3],argv+3);close(fd);return fail("lock exec");
}
static int lock_check(const char *path) {
 const char *text=getenv("CMU_IO_LOCK_FD");char *end;long v;struct stat a,b;
 if(!text||!*text){errno=EINVAL;return fail("missing inherited lock");}
 errno=0;v=strtol(text,&end,10);
 if(errno||*end||v<3||v>INT_MAX){errno=EINVAL;return fail("invalid inherited lock");}
 if(fstat((int)v,&a)<0||lstat(path,&b)<0)return fail("lock identity");
 if(!S_ISREG(a.st_mode)||!S_ISREG(b.st_mode)||a.st_dev!=b.st_dev||a.st_ino!=b.st_ino){errno=EINVAL;return fail("lock inode mismatch");}
 if(flock((int)v,LOCK_EX|LOCK_NB)<0)return fail("lock acquisition");
 puts("locked");return 0;
}
int main(int argc,char **argv) {
 char hex[65];
 if(argc==2&&!strcmp(argv[1],"version")){puts("cmu-io 0.2");return 0;}
 if(argc==3&&!strcmp(argv[1],"metadata"))return metadata(argv[2]);
 if(argc>=5&&!strcmp(argv[1],"lock-run"))return lock_run(argc,argv);
 if(argc==3&&!strcmp(argv[1],"lock-check"))return lock_check(argv[2]);
 if(argc==3 && !strcmp(argv[1],"sha256")) {
  if(hash_file(argv[2],hex)<0)return fail("sha256");puts(hex);return 0;
 }
 if(argc==4 && !strcmp(argv[1],"check")) {
  if(!valid_hash(argv[3])) {fputs("error: expected lowercase sha256\n",stderr);return 2;}
  if(hash_file(argv[2],hex)<0)return fail("check");
  if(strcmp(hex,argv[3])) {fputs("error: checksum mismatch\n",stderr);return 3;}
  puts("match");return 0;
 }
 if(argc==3 && (!strcmp(argv[1],"sync-file")||!strcmp(argv[1],"sync-dir"))) {
  if(flush_path(argv[2],!strcmp(argv[1],"sync-dir"))<0)return fail(argv[1]);puts("synced");return 0;
 }
 if(argc==5 && !strcmp(argv[1],"stage")) {
  if(!valid_hash(argv[4])) {fputs("error: expected lowercase sha256\n",stderr);return 2;}
  if(stage(argv[2],argv[3],argv[4])<0)return fail("stage (uncommitted output may remain)");puts("staged");return 0;
 }
 fputs("usage: cmu-io version | sha256 file | check file sha256 | metadata file | sync-file file | sync-dir directory | stage source new-file sha256 | lock-run lock-file executable args... | lock-check lock-file\n",stderr);return 2;
}
