import SwiftUI

struct ContentView: View {
    @StateObject private var client = RadarClient()
    @State private var isSignedIn = false
    @State private var alertApproval: ApprovalRequest?

    var body: some View {
        NavigationStack {
            Group {
                if isSignedIn {
                    radarView
                } else {
                    signInView
                }
            }
            .navigationTitle("Bidderly.win")
            .task {
                guard isSignedIn else { return }
                await client.refresh()
                alertApproval = client.snapshot?.approvals.first(where: {
                    $0.status == "pending" && $0.alertEligible
                })
            }
            .alert("Approval needed", item: $alertApproval) { _ in
                Button("Approve") {}
                Button("Request info", role: .cancel) {}
            } message: { approval in
                Text(approval.requestedAction)
            }
        }
    }

    private var signInView: some View {
        VStack(spacing: 18) {
            Image(systemName: "dot.radiowaves.left.and.right")
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(.teal)
            Text("Opportunity Radar")
                .font(.title2.bold())
            Button("Continue with Clerk") {
                isSignedIn = true
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private var radarView: some View {
        List {
            if let snapshot = client.snapshot {
                Section("Radar summary") {
                    Label("\(snapshot.scoutRun.sourcesScanned) sources scanned", systemImage: "globe")
                    Label("\(snapshot.scoutRun.findingsDiscovered) findings discovered", systemImage: "doc.text.magnifyingglass")
                    Label("\(snapshot.opportunities.count) qualified opportunities", systemImage: "gauge.with.dots.needle.50percent")
                    Label("\(snapshot.approvals.filter { $0.status == "pending" }.count) pending decisions", systemImage: "bell.badge")
                }

                Section("Pending approvals") {
                    ForEach(snapshot.approvals) { approval in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(approval.title).font(.headline)
                            Text(approval.blocker).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                }

                Section("Opportunities") {
                    ForEach(snapshot.opportunities) { opportunity in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(opportunity.title).font(.headline)
                            Text(opportunity.buyer).foregroundStyle(.secondary)
                            Text(opportunity.nextAction).font(.footnote).foregroundStyle(.teal)
                        }
                    }
                }
            } else if let errorMessage = client.errorMessage {
                Text(errorMessage).foregroundStyle(.red)
            } else {
                ProgressView()
            }
        }
        .refreshable {
            await client.refresh()
        }
    }
}
