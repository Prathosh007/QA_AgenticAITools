# GOAT Conversion Gap Report - NotificationServer

## Summary
- **Converted:** 83 test cases
- **Gapped:** 25 test cases (require manual execution or external tools)

## Gap Details
### DC_NS_10
- **Reason:** Web console UI verification - Qengine scope only

### DC_NS_21
- **Reason:** Linux agent timing verification requires Linux agent environment

### DC_NS_24
- **Reason:** Web console Admin > Server Settings interaction - Qengine scope

### DC_NS_25
- **Reason:** Web console alert verification - Qengine scope

### DC_NS_34
- **Reason:** RDS HTML/ActiveX viewer interaction - Qengine/browser scope

### DC_NS_39
- **Reason:** Web console live-status icon verification - Qengine scope

### DC_NS_40
- **Reason:** Web console live-status icon verification - Qengine scope

### DC_NS_41
- **Reason:** Agent-side Troubleshooting tool GUI interaction - native_gui_operation scope but tool-specific

### DC_NS_44
- **Reason:** Web console resource-action icon click - Qengine scope

### DC_NS_NEW_09
- **Reason:** Load generator with 500-2000 concurrent sockets - requires external load tool

### DC_NS_NEW_11
- **Reason:** 24-hour soak test with continuous churn - requires long-running load tool

### DC_NS_NEW_15
- **Reason:** Failover environment with two nodes - requires multi-machine orchestration

### DC_NS_NEW_18
- **Reason:** Process suspension with Process Hacker/debugger - requires external debugger tool

### DC_NS_NEW_19
- **Reason:** WAF configuration and network topology - requires external WAF setup

### DC_NS_NEW_20
- **Reason:** Multi-NIC agent with firewall rules - requires specific network config

### DC_NS_NEW_21
- **Reason:** All agent IPs blocked via firewall - requires specific network config

### DC_NS_NEW_22
- **Reason:** Forced TCP RST mid-read - requires iptables/WFP rule manipulation

### DC_NS_NEW_31
- **Reason:** Linux agent timing verification - requires Linux agent environment

### DC_NS_NEW_35
- **Reason:** Force access violation with debugger - requires external debugger tool

### DC_NS_NEW_39
- **Reason:** 200 concurrent registrations load test - requires external load tool

### DC_NS_NEW_40
- **Reason:** Force 3 crashes with debugger within 1 hour - requires debugger attachment

### DC_NS_NEW_53
- **Reason:** DNS A-record manipulation - requires DNS server control

### DC_NS_NEW_54
- **Reason:** 1000 agent 8-hour soak test - requires external load tool and extended time

### DC_NS_NEW_55
- **Reason:** SOMAXCONN overflow test - requires external load tool

### DC_NS_NEW_56
- **Reason:** ASIO variant build - requires special build configuration


