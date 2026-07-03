import { apiClient } from "@/lib/api";
import type { GameLog } from "@/types/games";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Spinner } from "./ui";

export interface GameLogsViewProps {
    gameId: number
}

export const GameLogsView = ({ gameId } : GameLogsViewProps) => {
    const [logs, setLogs] = useState<GameLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    

    const fetchLogs = useCallback(async () => {
        try {
        setLoading(true);
        const response = await apiClient.games.getGameLogs(gameId);
        setLogs(response.data);
        setError(null);
        } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load logs');
        } finally {
        setLoading(false);
        }
    }, [gameId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);
    
      if (loading) {
        return (
          <Card variant="elevated" padding="lg">
            <h2 className="text-2xl font-bold text-content-primary mb-6">Game Logs</h2>
            <div className="flex justify-center py-8">
              <Spinner size="lg" label="Loading logs..." />
            </div>
          </Card>
        );
      }
    
      if (error) {
        return (
          <Card variant="elevated" padding="lg">
            <h2 className="text-2xl font-bold text-content-primary mb-6">Game Logs</h2>
            <Alert variant="danger">
              <div className="space-y-3">
                <p>Failed to load logs: {error}</p>
                <Button variant="danger" size="sm" onClick={fetchLogs}>
                  Retry
                </Button>
              </div>
            </Alert>
          </Card>
        );
      }

    return (
        <>
          <Card variant="elevated" padding="lg">
            <h2 className="text-2xl font-bold text-content-primary mb-6">Game Logs</h2>
            {
                logs.map((log, index) => (
                  <div key={index} className="border border-theme-default rounded-lg p-4 m-2">
                    <div className="text-sm text-content-secondary mb-1">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    <p className="text-sm text-content-primary leading-7 break-words">
                      {log.message}
                    </p>
                  </div>
                ))
            }
          </Card>
        </>
    );
}
