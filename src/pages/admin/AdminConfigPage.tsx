import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { getAdminConfig, updateAdminConfig } from "@/lib/api";

export default function AdminConfigPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ['adminConfig'],
        queryFn: getAdminConfig
    });

    const mutation = useMutation({
        mutationFn: updateAdminConfig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminConfig'] });
            queryClient.invalidateQueries({ queryKey: ['authConfig'] });
            toast({ title: "Configuration updated successfully" });
        },
        onError: () => {
            toast({ title: "Failed to update configuration", variant: "destructive" });
        }
    });

    const [formData, setFormData] = useState({
        recaptcha_enabled: false,
        recaptcha_site_key: '',
        recaptcha_secret_key: '',
        google_oauth_enabled: false,
        google_client_id: '',
        google_client_secret: ''
    });

    useEffect(() => {
        if (data?.config) {
            setFormData({
                recaptcha_enabled: data.config.recaptcha_enabled,
                recaptcha_site_key: data.config.recaptcha_site_key || '',
                recaptcha_secret_key: data.config.recaptcha_secret_key || '',
                google_oauth_enabled: data.config.google_oauth_enabled,
                google_client_id: data.config.google_client_id || '',
                google_client_secret: data.config.google_client_secret || ''
            });
        }
    }, [data]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <p className="text-destructive">Failed to load configuration. Admin access required.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold">System Configuration</h2>
                <p className="text-muted-foreground">Manage authentication and integration settings</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* reCAPTCHA Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>reCAPTCHA v3</CardTitle>
                        <CardDescription>Configure reCAPTCHA for registration protection</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="recaptcha-enabled">Enable reCAPTCHA</Label>
                            <Switch
                                id="recaptcha-enabled"
                                checked={formData.recaptcha_enabled}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, recaptcha_enabled: checked }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="recaptcha-site-key">Site Key (Public)</Label>
                            <Input
                                id="recaptcha-site-key"
                                value={formData.recaptcha_site_key}
                                onChange={(e) => setFormData(prev => ({ ...prev, recaptcha_site_key: e.target.value }))}
                                placeholder="6Lc..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="recaptcha-secret-key">Secret Key (Server-side)</Label>
                            <Input
                                id="recaptcha-secret-key"
                                type="password"
                                value={formData.recaptcha_secret_key}
                                onChange={(e) => setFormData(prev => ({ ...prev, recaptcha_secret_key: e.target.value }))}
                                placeholder="6Lc..."
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Google OAuth Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Google OAuth</CardTitle>
                        <CardDescription>Configure Google Sign-In integration</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="google-oauth-enabled">Enable Google OAuth</Label>
                            <Switch
                                id="google-oauth-enabled"
                                checked={formData.google_oauth_enabled}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, google_oauth_enabled: checked }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="google-client-id">Client ID</Label>
                            <Input
                                id="google-client-id"
                                value={formData.google_client_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, google_client_id: e.target.value }))}
                                placeholder="xxx.apps.googleusercontent.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="google-client-secret">Client Secret</Label>
                            <Input
                                id="google-client-secret"
                                type="password"
                                value={formData.google_client_secret}
                                onChange={(e) => setFormData(prev => ({ ...prev, google_client_secret: e.target.value }))}
                                placeholder="GOCSPX-..."
                            />
                        </div>
                    </CardContent>
                </Card>

                <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Save Configuration
                </Button>
            </form>
        </div>
    );
}
