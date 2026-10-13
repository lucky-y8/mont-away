"""Build an auditable, separate topic index; never rewrite question records.

The three full exam papers are manually indexed. Summary PDFs do not vote.
教材/大纲依据与三套完整真题独立存档；关键词只用于把题库题目关联到考点。
"""
import argparse, hashlib, json, re, sys
from collections import Counter
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "focus-audit"
# id | chapter | title | printed textbook pages | focus/core, general, extension | requirement | recognition pattern | study advice
DEFINITIONS = r'''
network-basics|1|网络定义与资源共享|33-35|core|识记、领会|计算机网络的?(定义|功能|目的|自的)|记清互连、自治与资源共享，练习完整表述。
protocol|1|网络协议与三要素|34-35|core|识记、领会|网络协议|协议的?(定义|三要素|要素)|区分语法、语义、时序，并能结合通信过程解释。
topology|1|网络分类与拓扑|35-38|core|识记|拓扑|个域网|城域网|广域网|网络的?分类|用结构图区分星形、总线、环形、网状等拓扑。
network-structure|1|网络边缘、接入与核心|38-41|core|识记|网络边缘|接入网|网络核心|网络结构|区分端系统、接入网络与核心交换网络。
switching|1|电路、报文与分组交换|41-47|core|领会、应用|电路交换|报文交换|分组交换|数据交换|比较建立连接、存储转发、流水传输与资源占用。
performance|1|时延、吞吐量与时延带宽积|47-50|core|领会、应用|时延|延迟|吞吐|丢包率|带宽积|传输速率|分别计算传输与传播时延，再按链路和分组数量组合。
layers|1|OSI、TCP/IP 与分层服务|50-57|core|识记、领会|OSI|参考模型|TCP/IP|体系结构|表示层|会话层|服务访问点|分层|掌握各层功能、服务与协议的区别，练习跨层辨析。
security-basics|1|安全目标、威胁与安全体系|57-66|core|识记、领会|信息安全|安全威胁|安全目标|安全体系|机密性|可用性|被动攻击|主动攻击|拒绝服务|DoS|区分机密性、完整性、可用性和典型攻击形式。
history|1|网络与安全发展历史|66-68|extension|了解|ARPANET|诞生|发展历史|发展阶段|发展趋势|第一台|第一代|作为背景知识补充，不代替大纲重点。
app-structure|2|C/S、B/S 与应用体系结构|72-74|core|识记、领会|客户.?服务器|C/S|B/S|服务器进程|客户进程|网络应用体系|比较客户端与服务器的角色，理解 B/S 的本质。
app-communication|2|应用通信与 Socket 接口|74-76,99-110|general|识记、领会|Socket|套接字|应用编程接口|应用层服务|应用进程|网络应用.*通信|梳理进程标识、端口与套接字调用过程。
dns|2|DNS 域名结构与解析|76-79|core|领会、应用|DNS|域名|区分递归与迭代，能计算查询往返次数。
http|2|HTTP、连接方式与响应时间|79-89|core|领会、应用|HTTP|Web|万维网|Cookie|URL|流水线|流水方式|持久连接|按对象数量、连接方式和 RTT 计算页面获取时间。
email|2|电子邮件、SMTP 与 POP|89-96|core|识记、领会|SMTP|POP3?|IMAP|MIME|邮件|掌握发送、转发和读取邮件时使用的协议。
ftp|2|FTP 双连接与端口|96-97|core|识记、领会|FTP|文件传输协议|区分控制连接、数据连接及其端口和持续时间。
p2p|2|P2P 与文件分发|97-99|core|领会、应用|P2P|对等|文件分发|比较服务器上传、客户端下载和系统总上传能力的约束。
transport|3|传输层端口、复用与分解|113-119|core|识记、领会|传输层|端口号|二元组|四元组|复用与分解|多路分解|记清 UDP 二元组与 TCP 四元组的区别。
reliable|3|可靠传输机制|119-123|core|领会|可靠数据传输|可靠传输|确认.*重传|超时重传|自动重传|确认、序号、计时器、重传分别解决什么问题。
window|3|停等、GBN、SR 与窗口计算|119-131|core|领会、应用|停.?等|GBN|回退|后退|选择重传|滑动窗口|信道利用率|连续ARQ|以时序图推导利用率，检查窗口与序号位数的约束。
udp|3|UDP 特点、结构与应用选择|131-134|core|识记、领会|UDP|比较无连接、开销和时效性，并区分可靠性与校验和。
tcp-connection|3|TCP 连接建立与释放|134-150|core|领会、应用|握手|挥手|TCP.*(连接建立|建立连接|断开|释放|拆除)|同步序号|画出三次握手、四次挥手，解释各次确认的作用。
tcp-sequence|3|TCP 段结构与序号|134-150|core|领会、应用|TCP|确认序号|确认号|MSS|报文段序号|注意序号按字节计数，掌握确认号与首部字段。
tcp-flow|3|TCP 流量控制|134-150|core|领会、应用|流量控制|接收窗口|通告窗口|按接收方可用缓存更新窗口，区分流量控制与拥塞控制。
tcp-congestion|3|TCP 拥塞控制|134-150|core|领会、应用|拥塞|慢开始|慢启动|快恢复|快重传|拥塞避免|根据丢包或超时事件画出拥塞窗口的变化。
network-service|4|转发、虚电路与数据报网络|153-158|core|识记、领会|虚电路|数据报网络|网络层.*(服务|功能)|转发.*路由|路由.*转发|比较路由与转发、虚电路与数据报的服务方式。
router|4|路由器结构与网络互连|158-161|general|领会|路由器|交换结构|互连网络交换|异构网络|区分输入输出端口、交换结构与路由处理器。
network-congestion|4|网络层拥塞控制|161-165|core|识记、领会|准入控制|负载脱落|流量感知|流量调节|网络层.*拥塞|把流量感知、准入、调节与负载脱落联系起来。
ip-packet|4|IPv4 数据报与分片|165-185|core|识记、应用|分片|片偏移|IP数据报|IPv4.*首部|TTL|生存时间|检查 MTU、首部长度及片偏移以 8 字节为单位的规则。
subnet|4|IPv4 编址、子网与 CIDR|170-180|core|领会、应用|子网|掩码|CIDR|路由聚合|地址聚合|IP地址|IPv4地址|主机数|广播地址|网络地址|先确定前缀与主机位，再列网络地址、广播地址和可用范围。
dhcp|4|DHCP 动态地址分配|165-185|core|领会|DHCP|动态主机|理解发现、提供、请求、确认四个阶段。
nat|4|NAT 地址与端口转换|165-185|core|领会|NAT|网络地址转换|地址转换表|跟踪内外网地址及端口在转换表中的对应关系。
icmp|4|ICMP 控制报文|165-185|core|领会|ICMP|PING|Traceroute|区分差错报告与查询报文，理解典型诊断用途。
ipv6|4|IPv6 基础|165-185|general|了解|IPv6|了解地址表示与 IPv4 的主要差别。
route-algorithm|4|路由算法与最短路径|185-196|core|领会、应用|链路状态|距离向量|最短路径|Dijkstra|无穷计数|路由算法|路由表|逐轮更新距离向量或最短路径表，理解收敛问题。
route-protocol|4|RIP、OSPF 与 BGP|185-196|core|识记、领会|RIP|OSPF|BGP|自治系统|路由协议|比较作用范围、度量、底层协议和层次化路由。
link-service|5|链路服务与组帧|199-200|core|识记、领会|组帧|数据链路层|物理链路|点对点链路|广播链路|理解相邻结点传输、帧边界及链路流量控制。
crc|5|CRC 循环冗余校验|200-207|core|应用|CRC|循环冗余|生成多项式|模2除|补零、模 2 除、附加余数，注意生成多项式位数。
error-code|5|差错控制、奇偶与汉明码|200-207|core|领会、应用|差错|汉明|海明|奇偶|检错|纠错|前向|校验和|自动重发|区分检错和纠错能力，练习校验位和汉明距离。
multiplex|5|信道划分与多路复用|207-211|core|领会、应用|CDMA|TDMA?|FDMA?|WDMA?|码分|时分|频分|波分|多路复用|码片|正交|从时间、频率、波长、码字四个维度比较复用方式。
random-access|5|ALOHA 与 CSMA|211-214|core|领会|ALOHA|CSMA|随机访问|持续侦听|区分监听策略和冲突后的重传行为。
controlled-access|5|受控接入、轮询与令牌|207-221|core|领会|令牌|受控接入|轮询|区分集中控制与分散控制，理解令牌丢失等异常。
ethernet|5|以太网、CSMA/CD 与退避|214-230|core|领会、应用|以太网|CSMA/CD|最小帧长|冲突检测|争用期|退避|往返传播时延|联立发送时延与往返传播时延，理解最小帧长和退避。
arp|5|MAC 地址与 ARP|221-225|core|识记、领会|ARP|MAC地址|物理地址|地址解析|区分 IP 与 MAC 寻址，说明 ARP 请求和应答流程。
lan|5|局域网、交换机与 VLAN|221-234|core|领会、应用|交换机|网桥|VLAN|广播域|冲突域|自学习|理解交换机学习、转发、过滤及 VLAN 划分。
ppp|5|PPP 与透明传输|234-237|core|识记、领会|PPP|HDLC|透明传输|字节填充|比特填充|零比特|掌握组帧和填充规则，区分 PPP 的组成与功能。
communication|6|数据通信、码元与速率|240-245|core|识记、领会、应用|通信系统|通信方式|信号|模拟|数字通信|单工|双工|串行|并行|同步通信|异步通信|码元|波特|比特率|区分模拟与数字、同步与异步，掌握码元率与比特率关系。
media|6|传输介质|245-249|core|识记|光纤|双绞线|同轴|介质|卫星|微波|比较带宽、抗干扰能力、传播方式和适用场景。
capacity|6|信道容量与奈奎斯特、香农公式|249-252|core|领会、应用|香农|奈奎斯特|信道容量|信噪比|Nyquist|Shannon|无噪|有噪|最大.*速率|先区分有无噪声，将 dB 信噪比换成线性值再计算。
line-code|6|基带编码与波形|252-258|core|领会、应用|曼彻斯特|不归零|归零码|AMI|HDB3|CMI|米勒|基带|NRZ|RZ码|编码波形|双相码|画波形并说明直流分量、同步能力与连续同码问题。
modulation|6|频带调制与 QAM|258-265|core|识记、领会|QAM|ASK|FSK|PSK|调制|频带传输|键控|区分幅度、频率、相位及组合调制。
physical-interface|6|物理层接口规程|265-266|core|识记、领会|物理层|RS-?232|DTE|DCE|机械特性|电气特性|规程特性|记清机械、电气、功能、规程四类特性。
wireless|7|无线结构、模式与链路特征|268-271|core|识记、领会|无线网络|无线主机|基础设施|自组织|无线链路|隐藏站|隐藏终端|无线.*基本结构|区分基础设施与自组织模式，解释隐藏站问题。
mobility|7|移动寻址、路由与移动 IP|271-276,291-294|core|识记、领会|移动|归属|转交地址|外部代理|家网|电话号码|代理发现|梳理归属地址、转交地址、代理发现与注册流程。
wifi|7|IEEE 802.11 结构与地址|276-282|core|识记、领会|802[.．]11|基本服务集|BSS|接入点|AP|掌握 BSS、AP、关联过程和帧地址字段。
csma-ca|7|CSMA/CA 冲突避免|277-280|core|领会|CSMA/CA|冲突避免|RTS|CTS|NAV|DIFS|SIFS|画出监听、退避、发送和 ACK 的顺序，理解 RTS/CTS。
cellular|7|蜂窝网络与 3G、4G、5G|282-291|general|识记、领会|蜂窝|[2345]G|LTE|核心网|边缘计算|了解网络组成、移动性管理与各代主要特点。
short-wireless|7|蓝牙、WiMAX 与 ZigBee|294-296|general|识记|蓝牙|WiMAX|ZigBee|比较覆盖范围、功耗与常见应用。
crypto-basics|8|密码分类与攻击模型|298-300|core|识记、领会|密码学|密码分析|明文攻击|密文攻击|密码体制|分组密码|流密码|流式密码|加密模型|区分分组与流密码、对称与公钥体系及攻击条件。
traditional|8|替代、换位与传统加密|300-305|core|领会、应用|凯撒|移位密码|替代密码|替换密码|换位密码|置换密码|仿射|维吉尼亚|Vigen|乘数密码|按密钥逐步加解密，注意模运算和换位次序。
symmetric|8|对称加密、DES、AES 与 CBC|305-316|core|领会、应用|DES|AES|IDEA|RC[2456]|CBC|Feistel|对称密钥|对称加密|分组链接|理解轮结构、密钥与分组长度，以及 CBC 的链接过程。
public-crypto|8|公钥原理、RSA 与密钥交换|316-322|core|识记、领会、应用|RSA|公开密钥|公钥密码|非对称|Diffie|Hellman|椭圆曲线|ECC|ElGamal|陷门|理解公私钥作用，练习 RSA 密钥和简单模幂计算。
hash|8|散列函数、MD5 与 SHA|322-329|core|识记、领会|散列|哈希|MD5|SHA|Hash|区分单向性、抗碰撞及消息摘要的用途。
crypto-new|8|密码学新进展|329|extension|了解|量子|后量子|同态|轻量级密码|了解教材介绍的方向，优先保证基础算法。
integrity|9|报文认证与数字签名|332-336|core|识记、领会|数字签名|报文认证|消息认证|报文摘要|消息完整|数据完整|认证码|掌握完整性、来源认证与不可否认性的不同需求。
authentication|9|身份认证与重放防护|336-338|core|识记、领会|身份认证|重放|挑战.?应答|一次性随机|nonce|理解挑战应答及随机数如何阻止旧报文重放。
key-management|9|密钥分发、CA、KDC 与 PKI|338-344|core|识记、领会|PKI|KDC|证书|认证中心|密钥管理|密钥分发|密钥分配|数字信封|区分 KDC 与 CA，梳理证书认证和公钥绑定过程。
access|9|访问控制、DAC、MAC 与 RBAC|344-351|core|识记、领会|访问控制|RBAC|自主访问|强制访问|权能|主体|客体|区分主体、客体、权限与各类访问控制策略。
content|9|DRM、数字水印与内容监管|351-363|core|识记、领会|DRM|数字水印|水印|内容安全|内容保护|内容监管|版权|掌握版权授权、水印嵌入与检测、内容监管方法。
physical-security|9|物理安全|363-367|general|识记|物理安全|电磁|机房|设备安全|防雷|了解场地、设备、电磁和介质安全措施。
pgp|10|PGP 安全电子邮件|370-372|core|识记、领会|PGP|安全电子邮件|安全邮件|按签名、压缩、加密及接收还原的顺序梳理流程。
tls|10|SSL/TLS、握手与 HTTPS|372-376|core|识记、领会|SSL|TLS|HTTPS|安全套接|掌握握手协商、认证和密钥建立的用途。
ipsec|10|VPN、IPSec、AH、ESP 与 IKE|376-381|core|识记、领会、应用|IPSec|VPN|AH协议|ESP|IKE|安全关联|隧道|比较 AH/ESP、传输/隧道模式和 SA 的方向性。
firewall|10|防火墙分类、规则与部署|381-403|core|识记、领会、应用|防火墙|包过滤|分组过滤|DMZ|SOCKS|堡垒主机|区分静态过滤、状态检测、代理及 DMZ 部署。
ids|10|入侵检测的方法与过程|403-414|core|识记、领会|入侵检测|IDS|数据获取|异常检测|误用检测|串起数据采集、分析判断与响应，比较特征和异常检测。
risk|11|网络风险分析与评估|417-422|core|识记、领会|风险|脆弱性|资产|威胁评估|联系资产、威胁、脆弱性和安全措施，理解评估原则。
protection|11|等级保护与测评|422-429|core|识记、领会|等级保护|保护等级|定级|等级测评|掌握等级划分、定级要素和测评流程。
standards|11|信息安全相关标准|429-432|general|识记|标准|ISO|IEC|CC准则|TCSEC|认识教材列举的国内外安全标准及其用途。
laws|11|信息安全法律法规|432-440|core|识记|法律|法规|立法|网络安全法|个人信息|数据安全法|按教材掌握原则与体系；考试版本以当地公告为准。
'''
# Definitions include regex alternation; split from the ends, not all pipes.
TOPICS = []
SYLLABUS = {1:[6,7],2:[7,8],3:[8,9],4:[9,11],5:[11,12],6:[12,13],7:[13,14],8:[14,16],9:[16,17],10:[17,18],11:[18,19]}
for line in DEFINITIONS.strip().splitlines():
    head, advice = line.rsplit('|',1)
    ident, ch, title, pages, importance, level, pattern = head.split('|',6)
    spans = [[int(v) for v in part.split('-')] for part in pages.split(',')]
    spans = [[x[0],x[-1]] for x in spans]
    TOPICS.append(dict(id=ident,chapter=int(ch),title=title,bookPages=spans,syllabusPages=SYLLABUS[int(ch)],importance=importance,level=level,pattern=pattern,advice=advice))

# Each position is the actual numbered question in the supplied full paper.
EXAM_MAP = {
'2024-10': '''protocol http transport network-service crc communication wireless symmetric key-management firewall pgp tcp-flow wifi arp crypto-basics performance dns udp router link-service communication mobility symmetric key-management content network-basics mobility reliable authentication dns+http line-code'''.split(),
'2025-04': '''topology dns udp network-service crc communication mobility public-crypto access ipsec ftp content network-service risk switching layers app-communication transport network-service link-service communication wifi traditional key-management content protocol csma-ca tcp-connection ids subnet line-code'''.split(),
'2025-10': '''topology udp tcp-connection network-service ethernet communication wireless traditional content ipsec multiplex route-protocol communication error-code firewall layers app-structure transport network-service error-code communication cellular traditional access content network-basics wireless udp ids subnet line-code'''.split(),
}

def clean(text): return re.sub(r'\s+','',text).replace('／','/').upper()

def fingerprint(q):
    # UTF-16 FNV-1a matches JS charCodeAt; detects changed assessment inputs.
    s=json.dumps([q['type'],q['stem'],q['options']],ensure_ascii=False,separators=(',',':')).encode('utf-16-le')
    h=2166136261
    for i in range(0,len(s),2): h=((h ^ (s[i]|s[i+1]<<8))*16777619)&0xffffffff
    return format(h,'08x')

def chapter_of(q):
    if 1 <= q['chapter'] <= 11: return q['chapter']
    m=re.search(r'-c(\d+)-',q['id'])
    if m: return int(m.group(1))
    for tag in q.get('tags',[]):
        m=re.search(r'第([一二三四五六七八九十]+)章',tag)
        if m: return {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11}[m.group(1)]
    return None

def classify(q):
    s=clean(q['stem']); ch=chapter_of(q)
    def hits(text):
        return [t['id'] for t in TOPICS if (ch is None or t['chapter']==ch) and re.search(t['pattern'],text,re.I)]
    found=hits(s)
    # Specific topics suppress incidental general wording. Never classify from distractors.
    suppress={
      'http':['tcp-sequence','tcp-connection','app-structure'], 'pgp':['email','public-crypto','symmetric','hash','integrity'],
      'tls':['http','tcp-connection','tcp-sequence','symmetric','public-crypto'],
      'ipsec':['subnet','ip-packet','security-basics'], 'csma-ca':['random-access','ethernet','wifi','wireless'],
      'wifi':['wireless','arp'], 'cellular':['mobility','network-structure','wireless'],
      'tcp-connection':['tcp-sequence','transport'], 'tcp-flow':['tcp-sequence','transport'],
      'tcp-congestion':['tcp-sequence','transport'], 'udp':['transport'],
      'crc':['error-code'], 'line-code':['communication','error-code'], 'modulation':['communication','media'],
      'capacity':['communication','performance'], 'physical-interface':['communication'],
      'key-management':['public-crypto','integrity','authentication'], 'content':['security-basics'],
      'network-service':['router','switching'], 'route-protocol':['route-algorithm','router','transport'],
      'route-algorithm':['router'], 'subnet':['router'], 'ppp':['link-service'], 'ethernet':['random-access','link-service'],
      'network-congestion':['tcp-congestion'], 'firewall':['access','security-basics','layers'],
      'protection':['security-basics'], 'risk':['security-basics'], 'traditional':['crypto-basics'],
      'standards':['security-basics'], 'laws':['security-basics'], 'network-basics':['network-structure'],
      'window':['reliable','tcp-flow','tcp-sequence','transport'], 'protocol':['error-code'],
      'history':['switching','security-basics'],
    }
    if '流量控制' in s and ch==5: found=[x for x in found if x!='tcp-flow']
    # Topics used only as examples/distractors must not inflate exam frequency.
    for key,removed in suppress.items():
        if key in found: found=[x for x in found if x not in removed]
    if not found and q['type'] not in ['single','multiple','truefalse']:
        found=hits(clean(q['answer']))
        for key,removed in suppress.items():
            if key in found: found=[x for x in found if x not in removed]
    if q.get('materialId')=='blanks':
        # Source chapter and section headings are stronger evidence than broad keywords.
        section=q.get('tags',[''])[-1]
        section_map={'计算机网络基本概念':'network-basics','计算机网络结构':'network-structure','数据交换技术':'switching','计算机网络主要性能指标':'performance','计算机网络体系结构':'layers','信息安全概述':'security-basics','互联网的安全性':'security-basics','信息安全体系结构':'security-basics','发展简介':'history','网络应用体系结构':'app-structure','网络应用通信基本原理':'app-communication','Web应用':'http','停-等协议与滑动窗口协议':'window','网络层拥塞控制':'network-congestion','差错控制':'error-code','多路访问控制协议':'random-access','频带传输':'modulation','移动网络':'mobility','密码学概述':'crypto-basics','物理安全':'physical-security'}
        if not found: found=[v for k,v in section_map.items() if k in section][:1]
        allowed={
          1:['network-basics protocol topology','network-structure','switching','performance','layers','security-basics','security-basics','security-basics'],
          2:['app-structure p2p','app-communication','dns','http','email','ftp','p2p','app-communication'],
          3:['transport','transport','reliable window','udp','tcp-connection tcp-sequence tcp-flow tcp-congestion'],
          4:['network-service','network-service','router','network-congestion','ip-packet subnet dhcp nat icmp ipv6','route-algorithm route-protocol'],
          5:['link-service','error-code crc','multiplex random-access controlled-access ethernet','arp ethernet lan','ppp'],
          6:['communication','media','capacity','line-code','modulation','physical-interface'],
          7:['wireless','mobility','wifi csma-ca','cellular','mobility','short-wireless'],
          8:['crypto-basics','traditional','symmetric crypto-basics','public-crypto','hash','crypto-new'],
          9:['integrity hash','authentication','key-management','access','content','physical-security'],
          10:['pgp','tls','ipsec','firewall','ids'],
          11:['risk','protection','standards','laws','laws','laws'],
        }
        n=re.search(r'第([一二三四五六七八九十]+)节',section)
        if n and ch in allowed:
            no={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}[n.group(1)]
            candidates=allowed[ch][no-1].split()
            found=[x for x in found if x in candidates] or [candidates[0]]
    return found[:3]

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--project',type=Path,default=ROOT); ap.add_argument('--output',type=Path,default=ROOT/'study-room/data'); ap.add_argument('--book',type=Path); args=ap.parse_args(); OUT.mkdir(parents=True,exist_ok=True)
    qs=json.loads((args.project/'study-room/data/questions.json').read_text(encoding='utf-8'))
    by_id={q['id']:q for q in qs}; topics={t['id']:dict(t,evidence=[]) for t in TOPICS}
    overrides={}
    for term,items in EXAM_MAP.items():
        assert len(items)==31
        for i,assignment in enumerate(items,1):
            ident=f'exam-{term}-q{i:03d}'; q=by_id[ident]; overrides[ident]=assignment.split('+')
            for topic in overrides[ident]:
                topics[topic]['evidence'].append(dict(id=ident,term=term,number=i,type=q['type'],sourceUrl='/study-assets'+q['sourceUrl'],page=q['pages'][0]))
    fixes=Path(__file__).with_name('focus-mapping-overrides.json')
    if fixes.exists(): overrides.update(json.loads(fixes.read_text(encoding='utf-8')))
    for t in topics.values():
        t['examTerms']=sorted(set(e['term'] for e in t['evidence']))
        n=len(t['examTerms'])
        t['stars']=(min(5,3+n) if t['importance']=='core' else min(4,2+n) if t['importance']=='general' else 1)
        t.pop('pattern')
    mapped={}; audit=[]
    for q in qs:
        ids=overrides.get(q['id'],classify(q))
        assert all(i in topics for i in ids),(q['id'],ids)
        mapped[q['id']]=dict(topics=ids,fingerprint=fingerprint(q))
        audit.append(f"{q['id']}\t{chapter_of(q)}\t{','.join(ids) or 'UNMAPPED'}\t{q['stem']}\t{q['answer'][:100]}")
    data=dict(version=1,updatedAt='2026-10-13',target='2026 年 10 月',
        book=dict(title='计算机网络与信息安全',author='李全龙',edition='2024年版',publisher='机械工业出版社',pageCount=450,pdfPageOffset=7,sha256=hashlib.sha256(args.book.read_bytes()).hexdigest() if args.book else json.loads((args.project/'study-room/data/focus-priorities.json').read_text(encoding='utf-8'))['book']['sha256'],
        readScope='核对全书目录、各章学习目标/教师导读及书内大纲的考核要求；教材页码为对应知识节的定位。',
        catalogueUrl='https://www.shmeea.edu.cn/download/20260520/2.pdf',catalogueNote='上海市教育考试院 2026 年 10 月教材目录列明相同版本；其他地区与考期以当地公告为准。'),
        examTerms=list(EXAM_MAP),examQuestionCount=93,
        limitations=['仅采用已收录的三套完整真题；未纳入完整的 2026 年 4 月试卷。','汇总资料中的“某年真题”标注、教材例题及 04741 专项题均不增加真题复现次数。','星级是考点层面的复习优先级，不是本题原题重考概率；少量样本不能提供可靠命中率。','题型与数值可能变化；没有在样本中出现的考点也可能考查。'],
        rules=[dict(stars=5,label='高频重点',description='教材/大纲重点，且同一考点出现于至少 2 个已收录考期。'),dict(stars=4,label='优先复习',description='重点考点在 1 个考期出现，或一般考点在至少 2 个考期出现。'),dict(stars=3,label='核心巩固',description='教材/大纲重点但样本未出现，或一般考点在 1 个考期出现。'),dict(stars=2,label='基础覆盖',description='一般考核内容，样本中尚未出现。'),dict(stars=1,label='拓展了解',description='教材背景或拓展内容；不据此判定不会考。')],
        topics=list(topics.values()),questions=mapped)
    materials=json.loads((args.project/'study-room/data/materials.json').read_text(encoding='utf-8'))
    data['examSources']=[dict(id=m['id'], title=m['title'], sourceUrl='/study-assets'+m['sourceUrl'], sha256=hashlib.sha256((args.project/'study-room/public/study-assets'/m['sourceUrl'].lstrip('/')).read_bytes()).hexdigest()) for m in materials if m['kind']=='exam']
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/'focus-priorities.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (OUT/'mapping-audit.tsv').write_text('\n'.join(audit),encoding='utf-8')
    print('TOPICS',len(topics),'MAPPED',sum(bool(x['topics']) for x in mapped.values()),'TOTAL',len(mapped))
    print('STARS',dict(Counter(max((topics[i]['stars'] for i in x['topics']),default=0) for x in mapped.values())))
    for line in audit:
        if '\tUNMAPPED\t' in line: print(line)

if __name__=='__main__': main()
