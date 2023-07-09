import * as express from "express";
import { route, getFilesInFolder } from '../util';
import os from 'os';

const router = express.Router();

router.get('/', route(async (req, res, next) => {

    const info = os.userInfo();

    // TODO: support identifying disks from USB & SATA & PCIe connections

    // These are the open remote mounts?
    // ls /run/user/1000/gvfs
    const remotes = [
        'mtp:host=SAMSUNG_SAMSUNG_Android_R52N91JBK4M',
        'smb-share:server=192.168.1.156,share=downloads',
        'smb-share:server=nasdak.local,share=data'
    ]


    // findmnt
    const mounts = [
        // TARGET                         SOURCE         FSTYPE  OPTIONS
        // /                              /dev/mapper/vgubuntu-root
        // │                                             ext4    rw,noatime,errors=remount-
        // ├─/sys                         sysfs          sysfs   rw,nosuid,nodev,noexec,rel
        // │ ├─/sys/kernel/security       securityfs     securit rw,nosuid,nodev,noexec,rel
        // │ ├─/sys/fs/cgroup             cgroup2        cgroup2 rw,nosuid,nodev,noexec,rel
        // │ ├─/sys/fs/pstore             pstore         pstore  rw,nosuid,nodev,noexec,rel
        // │ ├─/sys/firmware/efi/efivars  efivarfs       efivarf rw,nosuid,nodev,noexec,rel
        // │ ├─/sys/fs/bpf                bpf            bpf     rw,nosuid,nodev,noexec,rel
        // │ ├─/sys/kernel/debug          debugfs        debugfs rw,nosuid,nodev,noexec,rel
        // │ ├─/sys/kernel/tracing        tracefs        tracefs rw,nosuid,nodev,noexec,rel
        // │ ├─/sys/fs/fuse/connections   fusectl        fusectl rw,nosuid,nodev,noexec,rel
        // │ └─/sys/kernel/config         configfs       configf rw,nosuid,nodev,noexec,rel
        // ├─/proc                        proc           proc    rw,nosuid,nodev,noexec,rel
        // │ └─/proc/sys/fs/binfmt_misc   systemd-1      autofs  rw,relatime,fd=29,pgrp=1,t
        // │   └─/proc/sys/fs/binfmt_misc binfmt_misc    binfmt_ rw,nosuid,nodev,noexec,rel
        // ├─/dev                         udev           devtmpf rw,nosuid,relatime,size=16
        // │ ├─/dev/pts                   devpts         devpts  rw,nosuid,noexec,relatime,
        // │ ├─/dev/shm                   tmpfs          tmpfs   rw,nosuid,nodev,inode64
        // │ ├─/dev/hugepages             hugetlbfs      hugetlb rw,relatime,pagesize=2M
        // │ └─/dev/mqueue                mqueue         mqueue  rw,nosuid,nodev,noexec,rel
        // ├─/run                         tmpfs          tmpfs   rw,nosuid,nodev,noexec,rel
        // │ ├─/run/lock                  tmpfs          tmpfs   rw,nosuid,nodev,noexec,rel
        // │ ├─/run/credentials/systemd-sysusers.service
        // │ │                            ramfs          ramfs   ro,nosuid,nodev,noexec,rel
        // │ ├─/run/qemu                  tmpfs          tmpfs   rw,nosuid,nodev,relatime,m
        // │ └─/run/user/1000             tmpfs          tmpfs   rw,nosuid,nodev,relatime,s
        // │   ├─/run/user/1000/gvfs      gvfsd-fuse     fuse.gv rw,nosuid,nodev,relatime,u
        // │   └─/run/user/1000/doc       portal         fuse.po rw,nosuid,nodev,relatime,u
        // ├─/home                        /dev/mapper/vgubuntu-home
        // │                                             ext4    rw,noatime,errors=remount-
        // └─/boot/efi                    /dev/nvme0n1p1 vfat    rw,relatime,fmask=0077,dma
    ]

    res.send({
        host: os.hostname(),
        user: info,
        filemanager:  {
            defaultLocations: [
                { label: "Starred", path: info.homedir + '/Starred', icon: "star" },
                { label: "Home", path: info.homedir, icon: "home" },
                { label: "Desktop", path: info.homedir + '/Desktop', icon: "desktop_windows" },
                { label: "Documents", path: info.homedir + '/Documents', icon: "description" },
                { label: "Downloads", path: info.homedir + '/Downloads', icon: "file_download" },
                { label: "Music", path: info.homedir + '/Music', icon: "library_music" },
                { label: "Pictures", path: info.homedir + '/Pictures', icon: "photo_library" },
                { label: "Videos", path: info.homedir + '/Videos', icon: "video_library" },
                { label: "Trash", path: '/local/share/Trash', icon: "delete_outline" },
            ],
            // List of device locations (cameras, flash storage etc)
            deviceLocations: [
                { label: "", path: '/', icon: "" },
            ],
            // list of remote connections (SMB/FTP)
            remoteLocations: [
                { label: "", path: '/', icon: "" },
            ]
        }
    });
}));

export const RestApi = router;
