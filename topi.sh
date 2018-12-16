#!/bin/bash
#send files to RPi
#set -x

#HERE="$(dirname "$(readlink -fm "$0")")" #https://stackoverflow.com/questions/20196034/retrieve-parent-directory-of-script
#MY_TOP=`git rev-parse --show-toplevel`  #from https://unix.stackexchange.com/questions/6463/find-searching-in-parent-directories-instead-of-subdirectories
#source  "$MY_TOP"/scripts/colors.sh
#source  "$HERE"/colors.sh
#from http://stackoverflow.com/questions/5947742/how-to-change-the-output-color-of-echo-in-linux
RED='\e[1;31m' #too dark: '\e[0;31m' #`tput setaf 1`
GREEN='\e[1;32m' #`tput setaf 2`
YELLOW='\e[1;33m' #`tput setaf 3`
BLUE='\e[1;34m' #`tput setaf 4`
PINK='\e[1;35m' #`tput setaf 5`
CYAN='\e[1;36m' #`tput setaf 6`
GRAY='\e[0;37m'
NORMAL='\e[0m' #`tput sgr0`

DEST="$1/node_modules/speaker"
SRC="."

set -x
cp "${SRC}/build/Release/binding.node" "${DEST}/build/Release/"
cp "${SRC}/index.js" "${DEST}/"

exit 1
#echo "i am at $HERE"
#echo use script "$HERE"/getcfg.js
#echo -e "${BLUE}running $HERE/getcfg.js${NORMAL}"
echo -e "${BLUE}setting vars${NORMAL}"
"$HERE"/getcfg.js
eval $("$HERE"/getcfg.js)

if [ $# -lt 1 ]; then
    echo -e "${RED}no files to transfer?${NORMAL}"
else
    for file in "$@"
    do
        echo -e "${BLUE}xfr ${CYAN}$file ${BLUE}at `date`${NORMAL}"
#        echo sshpass -p $RPi_pass scp "$file" $RPi_user@$RPi_addr:$RPi_folder
        sshpass -p $RPi_pass scp "$file" $RPi_user@$RPi_addr:$RPi_folder
    done
    echo -e "${GREEN}$# files xfred.${NORMAL}"
fi

#eof#
