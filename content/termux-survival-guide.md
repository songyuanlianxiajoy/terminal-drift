---
title: Termux 生存指南：只读根目录里的自由
date: 2026-11-12
summary: 在 Android 上，Linux 的常识几乎全部失效。$PREFIX 代替 /usr，bionic 代替 glibc，很多东西要跑在 proot 里。这是我踩过的几个坑。
tags: [Termux, Android, 工程]
---

Android 的内核是 Linux，但用户空间不是。第一次在 Termux 里敲 `ls /usr/bin` 会得到 `No such file or directory`，这不是命令坏了，而是你熟悉的那套文件系统布局在这里根本不存在。

## 三个事实

**第一，根目录只读。** 你改不了 `/etc`，也写不进 `/usr`。所有可写内容都在应用的私有目录里：

```bash
echo "$PREFIX"
# /data/data/com.termux/files/usr
echo "$HOME"
# /data/data/com.termux/files/home
```

`$PREFIX` 就是 Termux 的 `/usr`。`bin`、`lib`、`include` 都在它下面。软件包不是装到系统里，而是装进这个沙盒。

**第二，C 库是 bionic。** 绝大多数 Linux 发行版用 glibc，Android 用 bionic。一个按 glibc 编译的二进制拿过来，通常不是「少个库」那么简单，而是动态链接器路径都不对，直接 `cannot execute: required file not found`。

**第三，平台字符串是 `android`。** 在 Termux 的原生 Node 里：

```js
console.log(process.platform); // "android"
```

不是 `linux`。任何写着 `if (platform === "linux")` 的分支，在这里都会掉进 `else`。很多「在我电脑上好好的」工具，就是死在这一行。

## 坑一：内核太老，系统调用缺失

这台设备的内核是 4.14。`pidfd_open` 是 Linux 5.3 才有的系统调用，`statx` 则被 Android 的 seccomp 拦着。于是一个用 Node 写的 CLI 会出现非常诡异的症状：

```text
Unknown Error, pidfd_open
Error: FileSystem.stat: Unknown
```

而同一个程序在家目录下看起来又「基本正常」，让人误以为是路径权限问题。其实不是。用 `read` 读任何文件都会失败，数据库可证，家目录一样坏。

**教训：先确认环境，再怀疑代码。** 一次 `uname -r` 和一次最小复现，比翻两个小时业务逻辑有用。

## 坑二：`link()` 被文件系统拒绝

有些程序安装包时喜欢先写临时文件，再 `link()` 到目标位置，保证原子性。Termux 使用的文件系统不总是支持这种操作，于是报 `EACCES`，看上去像权限问题，实际是系统调用不被允许。

通用的修法是把它降级成 `rename()`：

```js
// 改之前
fs.linkSync(tmp, target);
// 改之后
fs.renameSync(tmp, target);
```

不是最优雅，但足够安全，而且能跑。给上游提 issue 时，这类补丁也容易被接受。

## 坑三：glibc 二进制要进 proot

有些工具只有 glibc 构建，又不方便重新编译。这时可以把 rootfs 装进用户目录，用 `proot` 模拟一个 Linux 用户空间：

```bash
proot -0 -r ~/ubuntu -b /dev -b /proc -b /data/data/com.termux/files/home \
      /usr/bin/env -i HOME=/root PATH=/usr/bin:/bin /bin/bash
```

代价是性能和一个很烦人的副作用：**proot 会等待它所有被 trace 的子进程**。如果程序在后台留下一个被信号停住的进程，proot 就永远不返回，外层终端卡死。所以用 proot 跑交互式程序时，最好加一个看门狗，主进程退出后按 `TracerPid` 收掉残留。

## 我的结论

在这类环境里工作，思路不是「把 Linux 搬过来」，而是「找到平台留出的那条缝」。

- 不要试图写系统目录，写 `$PREFIX`；
- 不要假设 `process.platform === "linux"`，把 `android` 当成一等公民；
- 不要和缺失的系统调用硬碰，绕过它，或者换一条路径；
- 每修一个平台分支，都顺手检查同一个文件里还有没有别的分支。

自由不来自权限，而来自知道边界在哪里。只读的根目录听起来很受限，但当你熟悉了 `$PREFIX`、proot 和那些奇怪的补丁之后，这台手机其实能做的事情，比想象中多得多。
